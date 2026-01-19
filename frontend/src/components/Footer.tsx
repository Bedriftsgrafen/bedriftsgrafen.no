import { Database, Mail } from 'lucide-react'
import { CONTACT_EMAIL } from '../constants/contact'

export function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300 mt-16">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Partners */}
          <div>
            <h2 className="text-white font-semibold mb-3">Samarbeid</h2>
            <div className="space-y-2 text-sm">
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-gray-400 hover:text-blue-400 flex items-center gap-2 transition-colors">
                Annonsere her?
              </a>
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-gray-400 hover:text-blue-400 flex items-center gap-2 transition-colors">
                Bli partner
              </a>
            </div>
          </div>

          {/* About */}
          <div>
            <h2 className="text-white font-semibold mb-3">Om Bedriftsgrafen</h2>
            <p className="text-sm text-gray-400">
              Gratis analyse av norske bedrifter basert på åpne data fra Brønnøysundregistrene.
            </p>
            <a
              href="https://codewiki.google/github.com/bedriftsgrafen/bedriftsgrafen.no"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-gray-400 hover:text-blue-400 flex items-center gap-2 mt-4"
            >
              <div className="h-4 w-4 flex items-center justify-center font-bold text-[10px] border border-current rounded-sm">CW</div>
              CodeWiki
            </a>
          </div>

          {/* Data Source */}
          <div>
            <h2 className="text-white font-semibold mb-3 flex items-center gap-2">
              <Database className="h-4 w-4" />
              Datakilde
            </h2>
            <p className="text-sm text-gray-400">
              Data hentet fra{' '}
              <a
                href="https://data.brreg.no"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 underline"
              >
                Brønnøysundregistrene
              </a>
              ,{' '}
              <a
                href="https://www.ssb.no"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 underline"
              >
                SSB
              </a>
              {' '}og{' '}
              <a
                href="https://www.kartverket.no"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 underline"
              >
                Kartverket
              </a>.
            </p>
          </div>

          {/* Contact */}
          <div>
            <h2 className="text-white font-semibold mb-3">Kontakt</h2>
            <div className="space-y-2">
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-sm text-gray-400 hover:text-blue-400 flex items-center gap-2"
              >
                <Mail className="h-4 w-4" />
                {CONTACT_EMAIL}
              </a>
              <a
                href="https://github.com/Bedriftsgrafen/bedriftsgrafen.no"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-gray-400 hover:text-blue-400 flex items-center gap-2"
              >
                <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                  <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.63-.33 2.47-.33.84 0 1.68.11 2.47.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0012 2z" />
                </svg>
                GitHub
              </a>
              <a
                href="https://no.linkedin.com/in/ken-solbakken-remen-3ab62252"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-gray-400 hover:text-blue-400 flex items-center gap-2"
              >
                <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                  <path d="M19 0h-14c-2.76 0-5 2.24-5 5v14c0 2.76 2.24 5 5 5h14c2.76 0 5-2.24 5-5v-14c0-2.76-2.24-5-5-5zM8 19H5V10h3v9zM6.5 8.25c-.97 0-1.75-.78-1.75-1.75s.78-1.75 1.75-1.75 1.75.78 1.75 1.75-.78 1.75-1.75 1.75zM19 19h-3v-4.74c0-1.42-.6-1.93-1.38-1.93-.73 0-1.27.35-1.62 1.03V19h-3V10h2.76v1.23h.04c.38-.72 1.17-1.47 2.52-1.47 1.86 0 3.08 1.17 3.08 3.56V19z" />
                </svg>
                LinkedIn
              </a>
            </div>
            <p className="text-xs text-gray-400 mt-4">
              <kbd className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-gray-300">/</kbd> for søk •
              <kbd className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-gray-300 ml-1">Esc</kbd> for å lukke
            </p>
          </div>

        </div>

        {/* Copyright */}
        <div className="border-t border-gray-800 mt-8 pt-6 text-center text-sm text-gray-400">
          © {new Date().getFullYear()} Bedriftsgrafen.no. Alle rettigheter reservert.
        </div>
      </div>
    </footer>
  )
}
