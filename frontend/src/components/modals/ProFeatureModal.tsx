/**
 * ProFeatureModal - Paywall modal for premium features
 * Shows Patreon signup CTA when user tries to access gated features
 */

import { memo, useCallback } from 'react'
import { Rocket, X } from 'lucide-react'
import { Modal } from '../common'
import { trackEvent } from '../../utils/analytics'

interface ProFeatureModalProps {
    isOpen: boolean
    onClose: () => void
    /** Called when user dismisses modal and wants to proceed anyway */
    onProceed?: () => void
    /** Feature name for analytics tracking */
    featureName?: string
}

export const ProFeatureModal = memo(function ProFeatureModal({
    isOpen,
    onClose,
    onProceed,
    featureName = 'export_csv'
}: ProFeatureModalProps) {
    const handlePatreonClick = useCallback(() => {
        trackEvent('pro_feature_cta', 'conversion', featureName, undefined, { platform: 'patreon' })
        window.open('https://patreon.com/bedriftsgrafen', '_blank', 'noopener,noreferrer')
    }, [featureName])

    const handleKofiClick = useCallback(() => {
        trackEvent('pro_feature_cta', 'conversion', featureName, undefined, { platform: 'kofi' })
        window.open('https://ko-fi.com/bedriftsgrafen', '_blank', 'noopener,noreferrer')
    }, [featureName])

    const handleDismiss = useCallback(() => {
        trackEvent('pro_feature_dismiss', 'conversion', featureName)
        onClose()
        // Allow user to proceed with download even without supporting
        if (onProceed) {
            onProceed()
        }
    }, [featureName, onClose, onProceed])

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="">
            <div className="text-center py-4">
                {/* Icon */}
                <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mb-4 shadow-lg">
                    <Rocket className="h-8 w-8 text-white" />
                </div>

                {/* Headline */}
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    Lås opp data-eksport 🚀
                </h2>

                {/* Body */}
                <p className="text-gray-600 mb-6 max-w-sm mx-auto">
                    Nedlasting av lister til Excel er en funksjon for våre støttespillere.
                    Spar tid i salgsarbeidet ditt!
                </p>

                {/* CTA Buttons */}
                <div className="space-y-3">
                    <button
                        onClick={handlePatreonClick}
                        className="w-full px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold rounded-lg hover:from-orange-600 hover:to-orange-700 transition-all shadow-md hover:shadow-lg"
                    >
                        Bli supporter på Patreon (fra 59,-/mnd)
                    </button>

                    <button
                        onClick={handleKofiClick}
                        className="w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all shadow-md hover:shadow-lg"
                    >
                        Støtt på Ko-fi (engangsbidrag)
                    </button>

                    <button
                        onClick={handleDismiss}
                        className="w-full px-6 py-2 text-gray-500 hover:text-gray-700 text-sm font-medium transition-colors flex items-center justify-center gap-1"
                    >
                        <X className="h-4 w-4" />
                        Nei takk, last ned gratis
                    </button>
                </div>

                {/* Trust text */}
                <p className="text-xs text-gray-400 mt-4">
                    Støtt et uavhengig norsk prosjekt
                </p>
            </div>
        </Modal>
    )
})
