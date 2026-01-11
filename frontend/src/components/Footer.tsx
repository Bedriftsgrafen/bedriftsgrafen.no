import { Database, Github, Mail } from 'lucide-react'
import { CONTACT_EMAIL } from '../constants/contact'

export function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300 mt-16">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Partners */}
          <div>
            <h3 className="text-white font-semibold mb-3">Samarbeid</h3>
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
            <h3 className="text-white font-semibold mb-3">Om Bedriftsgrafen</h3>
            <p className="text-sm text-gray-400">
              Gratis analyse av norske bedrifter basert på åpne data fra Brønnøysundregistrene.
            </p>
          </div>

          {/* Data Source */}
          <div>
            <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
              <Database className="h-4 w-4" />
              Datakilde
            </h3>
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
            <h3 className="text-white font-semibold mb-3">Kontakt</h3>
            <div className="space-y-2">
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-sm text-gray-400 hover:text-blue-400 flex items-center gap-2"
              >
                <Mail className="h-4 w-4" />
                {CONTACT_EMAIL}
              </a>
              <a
                href="https://github.com/sponsors/kerem9811"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-gray-400 hover:text-blue-400 flex items-center gap-2"
              >
                <Github className="h-4 w-4" />
                GitHub
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
    </footer >
  )
}
