import { memo } from 'react'
import { Link } from '@tanstack/react-router'
import { BarChart3, ArrowRight } from 'lucide-react'

/**
 * Hero CTA section promoting the Industry Explorer (/bransjer).
 * Uses same icon as header navigation for consistency.
 */
export const ExplorerCTA = memo(function ExplorerCTA() {
    return (
        <section className="mb-8">
            <Link
                to="/bransjer"
                className="group block search-gradient text-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 overflow-hidden"
            >
                {/* Centered content */}
                <div className="relative z-10 p-8 text-center">
                    {/* Title with icon */}
                    <h2 className="text-2xl md:text-3xl font-bold mb-2 drop-shadow-lg flex items-center gap-3 justify-center">
                        <BarChart3 className="h-7 w-7" />
                        Utforsk alle norske bransjer
                    </h2>
                    <p className="text-white/90 text-lg mb-6">
                        Søk, filtrer og sammenlign bedrifter på tvers av 600+ industrier
                    </p>

                    {/* CTA Button - white like search button for consistency */}
                    <div className="inline-flex items-center gap-2 px-6 py-3 bg-white text-blue-900 font-bold rounded-lg hover:bg-blue-50 transition-all shadow-lg">
                        <span>Åpne bransje-utforsker</span>
                        <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                    </div>
                </div>
            </Link>
        </section>
    )
})
