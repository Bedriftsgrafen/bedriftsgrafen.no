/**
 * Lighthouse CI Configuration
 *
 * Run locally:   npm run lighthouse
 * Run in CI:     lhci autorun
 *
 * Reports are uploaded to temporary-public-storage (auto-deletes after 7 days)
 */
module.exports = {
    ci: {
        collect: {
            // URLs to audit - key user-facing pages
            // Note: Excluding /kart (requires backend), /bedrift/:orgnr (dynamic)
            url: [
                'http://localhost:4173/',             // Home/search
                'http://localhost:4173/search',       // Search with results
                'http://localhost:4173/om',           // About page
                'http://localhost:4173/bransjer',     // Industries
                'http://localhost:4173/konkurser',    // Bankruptcies
                'http://localhost:4173/nyetableringer', // New establishments
                'http://localhost:4173/utforsk',      // Explore
            ],
            // Start the Vite preview server for auditing built assets
            startServerCommand: 'npm run preview -- --port 4173',
            startServerReadyPattern: 'Local:',
            startServerReadyTimeout: 30000,
            numberOfRuns: 3, // Run 3 times and take median for accuracy
            settings: {
                // Throttle to simulate real-world conditions
                throttlingMethod: 'simulate',
            },
        },
        assert: {
            // Use NO preset - define all assertions explicitly for control
            assertions: {
                // === CATEGORY SCORES (Hard requirements) ===
                // Performance: warn at 0.5, allow lower for now
                'categories:performance': ['warn', { minScore: 0.5 }],
                // Accessibility: strict - error below 0.85
                'categories:accessibility': ['error', { minScore: 0.85 }],
                // Best Practices: warn below 0.8
                'categories:best-practices': ['warn', { minScore: 0.8 }],
                // SEO: warn below 0.9
                'categories:seo': ['warn', { minScore: 0.9 }],

                // === TURN OFF NOISY/IRRELEVANT AUDITS ===
                // Source maps not needed in production
                'valid-source-maps': 'off',
                // These are informational, not actionable failures
                'network-dependency-tree-insight': 'off',
                'unused-javascript': 'off',
                'render-blocking-resources': 'off',
                'render-blocking-insight': 'off',
                'image-delivery-insight': 'off',
                'cls-culprits-insight': 'off',
                // Not supported in all environments
                'uses-http2': 'off',
                'unsized-images': 'off',
                // Relaxed image audits (handled separately)
                'uses-responsive-images': 'off',
                'offscreen-images': 'off',

                // === ACCESSIBILITY (Track existing issues) ===
                'button-name': ['warn', { minScore: 0.9 }],
                'heading-order': ['warn', { minScore: 0.9 }],

                // === PERFORMANCE (Warn only, track over time) ===
                'first-contentful-paint': 'off',
                'largest-contentful-paint': 'off',
                'cumulative-layout-shift': 'off',
                'interactive': 'off',
                'speed-index': 'off',
                'max-potential-fid': 'off',
                'errors-in-console': 'off', // Only an issue if backend not running
            },
        },
        upload: {
            // For local runs, use temporary public storage (free, auto-deletes after 7 days)
            target: 'temporary-public-storage',
        },
    },
};
