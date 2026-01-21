import { Phone, Smartphone, Mail, Globe } from 'lucide-react'

interface ContactCardProps {
    telefon?: string
    mobil?: string
    epostadresse?: string
    hjemmeside?: string
}

/**
 * ContactCard - Displays company contact information with clickable links.
 * Renders phone (tel:), mobile (tel:), email (mailto:), and website (https://) links.
 */
export function ContactCard({ telefon, mobil, epostadresse, hjemmeside }: ContactCardProps) {
    // Don't render if no contact info
    const hasContactInfo = telefon || mobil || epostadresse || hjemmeside
    if (!hasContactInfo) return null

    // Clean phone number for tel: link (remove spaces)
    const formatPhoneHref = (phone: string) => `tel:${phone.replace(/\s/g, '')}`

    // Ensure website has protocol
    const formatWebsiteHref = (url: string) =>
        url.startsWith('http') ? url : `https://${url}`

    return (
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Phone className="h-5 w-5 text-green-600" />
                Kontakt
            </h3>
            <div className="space-y-3">
                {telefon && (
                    <div className="flex items-center gap-3">
                        <Phone className="h-4 w-4 text-gray-400" />
                        <div>
                            <div className="text-sm text-gray-500">Telefon</div>
                            <a
                                href={formatPhoneHref(telefon)}
                                className="text-blue-600 hover:underline font-medium"
                            >
                                {telefon}
                            </a>
                        </div>
                    </div>
                )}

                {mobil && (
                    <div className="flex items-center gap-3">
                        <Smartphone className="h-4 w-4 text-gray-400" />
                        <div>
                            <div className="text-sm text-gray-500">Mobil</div>
                            <a
                                href={formatPhoneHref(mobil)}
                                className="text-blue-600 hover:underline font-medium"
                            >
                                {mobil}
                            </a>
                        </div>
                    </div>
                )}

                {epostadresse && (
                    <div className="flex items-center gap-3">
                        <Mail className="h-4 w-4 text-gray-400" />
                        <div>
                            <div className="text-sm text-gray-500">E-post</div>
                            <a
                                href={`mailto:${epostadresse}`}
                                className="text-blue-600 hover:underline font-medium"
                            >
                                {epostadresse}
                            </a>
                        </div>
                    </div>
                )}

                {hjemmeside && (
                    <div className="flex items-center gap-3">
                        <Globe className="h-4 w-4 text-gray-400" />
                        <div>
                            <div className="text-sm text-gray-500">Nettside</div>
                            <a
                                href={formatWebsiteHref(hjemmeside)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline font-medium"
                            >
                                {hjemmeside}
                            </a>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
