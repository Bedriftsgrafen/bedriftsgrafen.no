import { ArrowUpRight, Database, Mail } from 'lucide-react'
import { CONTACT_EMAIL } from '../constants/contact'
import { BedriftsgrafenContactLink } from './contact'

const CURRENT_YEAR = new Date().getFullYear()

export function Footer() {
  return (
    <footer className="mt-10 border-t border-slate-800 bg-slate-950 text-slate-300 pb-[env(safe-area-inset-bottom)] md:mt-12">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 md:py-14">
        <div className="mb-10 flex flex-col gap-5 border-b border-white/10 pb-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-300">Bedriftsgrafen.no</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Innsikt i norske virksomheter, bygget på åpne data.
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-400 sm:text-base">
              Gratis analyse av norske virksomheter basert på åpne data fra Brønnøysundregistrene, SSB og Kartverket.
            </p>
          </div>

          <div className="inline-flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
            <span className="font-semibold text-white">Hurtigtaster</span>
            <span className="inline-flex items-center gap-2">
              <kbd className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-200">/</kbd>
              <span>for søk</span>
            </span>
            <span className="text-white/20">•</span>
            <span className="inline-flex items-center gap-2">
              <kbd className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-200">Esc</kbd>
              <span>for å lukke</span>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h2 className="text-base font-semibold text-white">Om Bedriftsgrafen</h2>
            <p className="mt-4 text-sm leading-7 text-slate-400">
              Gratis analyse av norske virksomheter basert på åpne data fra Brønnøysundregistrene.
            </p>
            <a
              href="https://codewiki.google/github.com/bedriftsgrafen/bedriftsgrafen.no"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-slate-200 transition-colors hover:border-white/20 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-md border border-current text-[10px] font-bold">CW</span>
              <span>CodeWiki</span>
              <ArrowUpRight aria-hidden="true" className="h-4 w-4 text-slate-500" />
            </a>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h2 className="flex items-center gap-2 text-base font-semibold text-white">
              <Database className="h-4 w-4 text-blue-300" aria-hidden="true" />
              Datakilde
            </h2>
            <p className="mt-4 text-sm leading-7 text-slate-400">
              Data hentet fra{' '}
              <a
                href="https://data.brreg.no"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-blue-300 transition-colors hover:text-blue-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                Brønnøysundregistrene
              </a>
              ,{' '}
              <a
                href="https://www.ssb.no"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-blue-300 transition-colors hover:text-blue-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                SSB
              </a>
              {' '}og{' '}
              <a
                href="https://www.kartverket.no"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-blue-300 transition-colors hover:text-blue-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                Kartverket
              </a>
              .
            </p>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h2 className="text-base font-semibold text-white">Kontakt Bedriftsgrafen.no</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">Kun spørsmål om nettsiden, data eller feil i tjenesten.</p>
            <div className="mt-4 space-y-3">
              <BedriftsgrafenContactLink
                className="inline-flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm font-medium text-slate-200 transition-colors hover:border-white/20 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                <span className="inline-flex items-center gap-2">
                  <Mail className="h-4 w-4 text-blue-300" aria-hidden="true" />
                  {CONTACT_EMAIL}
                </span>
                <ArrowUpRight aria-hidden="true" className="h-4 w-4 text-slate-500" />
              </BedriftsgrafenContactLink>
              <a
                href="https://github.com/Bedriftsgrafen/bedriftsgrafen.no"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-slate-200 transition-colors hover:border-white/20 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                <span className="inline-flex items-center gap-2">
                  <svg aria-hidden="true" className="h-4 w-4 fill-current text-blue-300" viewBox="0 0 24 24">
                    <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.63-.33 2.47-.33.84 0 1.68.11 2.47.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0012 2z" />
                  </svg>
                  GitHub
                </span>
                <ArrowUpRight aria-hidden="true" className="h-4 w-4 text-slate-500" />
              </a>
              <a
                href="https://no.linkedin.com/in/ken-solbakken-remen-3ab62252"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-slate-200 transition-colors hover:border-white/20 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                <span className="inline-flex items-center gap-2">
                  <svg aria-hidden="true" className="h-4 w-4 fill-current text-blue-300" viewBox="0 0 24 24">
                    <path d="M19 0h-14c-2.76 0-5 2.24-5 5v14c0 2.76 2.24 5 5 5h14c2.76 0 5-2.24 5-5v-14c0-2.76-2.24-5-5-5zM8 19H5V10h3v9zM6.5 8.25c-.97 0-1.75-.78-1.75-1.75s.78-1.75 1.75-1.75 1.75.78 1.75 1.75-.78 1.75-1.75 1.75zM19 19h-3v-4.74c0-1.42-.6-1.93-1.38-1.93-.73 0-1.27.35-1.62 1.03V19h-3V10h2.76v1.23h.04c.38-.72 1.17-1.47 2.52-1.47 1.86 0 3.08 1.17 3.08 3.56V19z" />
                  </svg>
                  LinkedIn
                </span>
                <ArrowUpRight aria-hidden="true" className="h-4 w-4 text-slate-500" />
              </a>
            </div>
          </section>
        </div>

        <div className="mt-8 border-t border-white/10 pt-6 text-sm text-slate-400 sm:flex sm:items-center sm:justify-between">
          <p>© {CURRENT_YEAR} Bedriftsgrafen.no. Alle rettigheter reservert.</p>
          <p className="mt-2 sm:mt-0">Bygget for raske søk, sammenligning og innsikt i norske virksomheter.</p>
        </div>
      </div>
    </footer>
  )
}
