import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';

import * as chromeLauncher from 'chrome-launcher';
import lighthouse from 'lighthouse';

const require = createRequire(import.meta.url);
const config = require('../lighthouserc.cjs').ci;
const projectRoot = path.resolve(import.meta.dirname, '..');

function parseOptions(args) {
    const options = { runs: config.collect.numberOfRuns, urls: [] };

    for (let index = 0; index < args.length; index += 1) {
        const argument = args[index];
        if (argument === '--runs') {
            const runs = Number.parseInt(args[index + 1], 10);
            if (!Number.isInteger(runs) || runs < 1) {
                throw new Error('--runs must be a positive integer');
            }
            options.runs = runs;
            index += 1;
        } else if (argument === '--url') {
            const url = args[index + 1];
            if (!url) {
                throw new Error('--url requires a value');
            }
            options.urls.push(url);
            index += 1;
        } else {
            throw new Error(`Unknown argument: ${argument}`);
        }
    }

    if (options.urls.length === 0) {
        options.urls = config.collect.url;
    }
    return options;
}

function delay(milliseconds) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function startPreviewServer() {
    const server = spawn(config.collect.startServerCommand, config.collect.startServerArgs, {
        cwd: path.resolve(projectRoot, config.collect.startServerCwd),
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    const readyPattern = config.collect.startServerReadyPattern;
    const timeout = config.collect.startServerReadyTimeout;

    try {
        await new Promise((resolve, reject) => {
            let settled = false;
            const timer = setTimeout(() => {
                if (!settled) {
                    settled = true;
                    reject(new Error(`Preview server did not become ready within ${timeout}ms`));
                }
            }, timeout);

            const handleOutput = (chunk) => {
                const output = chunk.toString();
                process.stdout.write(output);
                if (!settled && output.includes(readyPattern)) {
                    settled = true;
                    clearTimeout(timer);
                    resolve();
                }
            };

            server.stdout.on('data', handleOutput);
            server.stderr.on('data', handleOutput);
            server.once('exit', (code, signal) => {
                if (!settled) {
                    settled = true;
                    clearTimeout(timer);
                    reject(new Error(`Preview server exited before readiness (code=${code}, signal=${signal})`));
                }
            });
            server.once('error', (error) => {
                if (!settled) {
                    settled = true;
                    clearTimeout(timer);
                    reject(error);
                }
            });
        });
    } catch (error) {
        await stopPreviewServer(server);
        throw error;
    }

    return server;
}

async function stopPreviewServer(server) {
    if (!server || server.exitCode !== null) {
        return;
    }

    const exited = once(server, 'exit');
    server.kill('SIGTERM');
    await Promise.race([exited, delay(5000)]);
    if (server.exitCode === null) {
        const killed = once(server, 'exit');
        server.kill('SIGKILL');
        await Promise.race([killed, delay(1000)]);
    }
}

function pageSlug(url) {
    const pathname = new URL(url).pathname.replace(/^\/+|\/+$/g, '');
    return pathname.replace(/[^a-z0-9]+/gi, '-') || 'home';
}

function median(values) {
    const sorted = [...values].sort((left, right) => left - right);
    return sorted[Math.floor(sorted.length / 2)];
}

function scoreForAssertion(lhr, assertionId) {
    if (assertionId.startsWith('categories:')) {
        return lhr.categories[assertionId.slice('categories:'.length)]?.score;
    }
    return lhr.audits[assertionId]?.score;
}

function evaluateAssertions(url, results) {
    const evaluations = [];
    let hasError = false;

    for (const [assertionId, assertion] of Object.entries(config.assert.assertions)) {
        if (assertion === 'off') {
            continue;
        }

        const [level, criteria = {}] = assertion;
        const scores = results
            .map((result) => scoreForAssertion(result, assertionId))
            .filter((score) => typeof score === 'number');
        const score = scores.length > 0 ? median(scores) : null;
        const passed = score !== null && (criteria.minScore === undefined || score >= criteria.minScore);
        const evaluation = { assertionId, level, minScore: criteria.minScore ?? null, score, passed };
        evaluations.push(evaluation);

        if (!passed) {
            const actual = score === null ? 'missing' : score.toFixed(2);
            const expected = criteria.minScore === undefined ? 'available' : `>= ${criteria.minScore.toFixed(2)}`;
            const message = `${level.toUpperCase()} ${url} ${assertionId}: ${actual} (expected ${expected})`;
            if (level === 'error') {
                hasError = true;
                console.error(message);
            } else {
                console.warn(message);
            }
        }
    }

    return { evaluations, hasError };
}

async function runPage(url, runs, chromePort, reportDir) {
    const results = [];
    const reports = [];
    const slug = pageSlug(url);
    const lighthouseConfig = {
        extends: 'lighthouse:default',
        settings: config.collect.settings,
    };

    for (let run = 1; run <= runs; run += 1) {
        console.log(`Lighthouse ${url} (${run}/${runs})`);
        const runnerResult = await lighthouse(
            url,
            { logLevel: 'error', output: 'html', port: chromePort },
            lighthouseConfig,
        );
        if (!runnerResult) {
            throw new Error(`Lighthouse returned no result for ${url}`);
        }

        const baseName = `${slug}-run-${run}`;
        const htmlPath = path.join(reportDir, `${baseName}.html`);
        const jsonPath = path.join(reportDir, `${baseName}.json`);
        const htmlReport = Array.isArray(runnerResult.report) ? runnerResult.report[0] : runnerResult.report;
        await writeFile(htmlPath, htmlReport, 'utf8');
        await writeFile(jsonPath, `${JSON.stringify(runnerResult.lhr, null, 2)}\n`, 'utf8');
        results.push(runnerResult.lhr);
        reports.push({ html: path.relative(projectRoot, htmlPath), json: path.relative(projectRoot, jsonPath) });
    }

    const { evaluations, hasError } = evaluateAssertions(url, results);
    const categoryScores = Object.fromEntries(
        Object.keys(results[0].categories).map((categoryId) => {
            const scores = results
                .map((result) => result.categories[categoryId].score)
                .filter((score) => typeof score === 'number');
            return [categoryId, scores.length > 0 ? median(scores) : null];
        }),
    );
    console.log(
        `${url}: ${Object.entries(categoryScores)
            .map(([category, score]) => `${category}=${score === null ? 'missing' : Math.round(score * 100)}`)
            .join(' ')}`,
    );

    return { url, lighthouseVersion: results[0].lighthouseVersion, categoryScores, evaluations, reports, hasError };
}

async function main() {
    const options = parseOptions(process.argv.slice(2));
    const reportDir = path.resolve(projectRoot, config.runner.reportDir);
    await rm(reportDir, { recursive: true, force: true });
    await mkdir(reportDir, { recursive: true });

    let server;
    let chrome;
    const pages = [];
    try {
        server = await startPreviewServer();
        const chromeFlags = ['--headless', '--disable-dev-shm-usage'];
        if (process.getuid?.() === 0) {
            chromeFlags.push('--no-sandbox');
        }
        chrome = await chromeLauncher.launch({ chromeFlags });

        for (const url of options.urls) {
            pages.push(await runPage(url, options.runs, chrome.port, reportDir));
        }
    } finally {
        try {
            if (chrome) {
                await chrome.kill();
            }
        } finally {
            await stopPreviewServer(server);
        }
    }

    const summary = {
        generatedAt: new Date().toISOString(),
        numberOfRuns: options.runs,
        lighthouseVersion: pages[0]?.lighthouseVersion ?? null,
        pages: pages.map(({ hasError: _hasError, ...page }) => page),
    };
    await writeFile(path.join(reportDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

    if (pages.some((page) => page.hasError)) {
        process.exitCode = 1;
    }
}

main().catch((error) => {
    console.error(error instanceof Error ? error.stack : error);
    process.exitCode = 1;
});
