import { Banknote, Building2, Calendar, Users } from 'lucide-react'
import { formatCurrency } from '../../utils/formatters'

interface CapitalInfoCardProps {
    orgnr: string
    aksjekapital?: number
    antallAksjer?: number
    sisteRegnskapsaar?: string
    erIKonsern?: boolean
    institusjonellSektor?: string
}

/**
 * CapitalInfoCard - Displays company capital and corporate structure information.
 * Shows share capital, number of shares, latest financial year, group membership, and sector.
 */
export function CapitalInfoCard({
    aksjekapital,
    antallAksjer,
    sisteRegnskapsaar,
    erIKonsern,
    institusjonellSektor
}: Omit<CapitalInfoCardProps, 'orgnr'>) {
    // Don't render if no capital info
    const hasInfo = aksjekapital || antallAksjer || sisteRegnskapsaar || erIKonsern || institusjonellSektor
    if (!hasInfo) return null

    // Format large numbers with thousand separators
    const formatNumber = (num: number) => num.toLocaleString('nb-NO')

    return (
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Banknote className="h-5 w-5 text-green-600" />
                Kapitalinformasjon
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {aksjekapital !== undefined && aksjekapital !== null && (
                    <div className="flex items-start gap-3">
                        <Banknote className="h-4 w-4 text-gray-400 mt-0.5" />
                        <div>
                            <div className="text-sm text-gray-500">Aksjekapital</div>
                            <div className="font-medium text-gray-900">{formatCurrency(aksjekapital)}</div>
                        </div>
                    </div>
                )}

                {antallAksjer !== undefined && antallAksjer !== null && (
                    <div className="flex items-start gap-3">
                        <Users className="h-4 w-4 text-gray-400 mt-0.5" />
                        <div>
                            <div className="text-sm text-gray-500">Antall aksjer</div>
                            <div className="font-medium text-gray-900">{formatNumber(antallAksjer)}</div>
                        </div>
                    </div>
                )}

                {sisteRegnskapsaar && (
                    <div className="flex items-start gap-3">
                        <Calendar className="h-4 w-4 text-gray-400 mt-0.5" />
                        <div>
                            <div className="text-sm text-gray-500">Siste regnskap</div>
                            <div className="font-medium text-gray-900">{sisteRegnskapsaar}</div>
                        </div>
                    </div>
                )}

                {erIKonsern && (
                    <div className="flex items-start gap-3">
                        <Building2 className="h-4 w-4 text-gray-400 mt-0.5" />
                        <div>
                            <div className="text-sm text-gray-500">Konsern</div>
                            <span className="font-medium text-gray-900">Del av konsern</span>
                        </div>
                    </div>
                )}

                {institusjonellSektor && (
                    <div className="flex items-start gap-3 sm:col-span-2">
                        <Building2 className="h-4 w-4 text-gray-400 mt-0.5" />
                        <div>
                            <div className="text-sm text-gray-500">Sektor</div>
                            <div className="font-medium text-gray-900">{institusjonellSektor}</div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
