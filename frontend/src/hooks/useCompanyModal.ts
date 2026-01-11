import { useState, useCallback } from 'react'
import { useToastStore } from '../store/toastStore'
import { copyToClipboard } from '../utils/clipboard'

interface UseCompanyModalOptions {
  company?: {
    orgnr: string
    navn: string
  }
}

/**
 * Hook for managing company modal state and actions
 */
export function useCompanyModal({ company }: UseCompanyModalOptions = {}) {
  const [copiedOrgnr, setCopiedOrgnr] = useState(false)
  const addToast = useToastStore((state) => state.addToast)

  const handleCopyOrgnr = useCallback(async (orgnr: string) => {
    const success = await copyToClipboard(orgnr)
    if (success) {
      setCopiedOrgnr(true)
      addToast('success', 'Organisasjonsnummer kopiert!')
      setTimeout(() => setCopiedOrgnr(false), 2000)
    } else {
      addToast('error', 'Kunne ikke kopiere')
    }
  }, [addToast])

  const handleShare = useCallback(async () => {
    if (!company) return

    const shareData = {
      title: `${company.navn} - Bedriftsgrafen`,
      text: `Sjekk ut nøkkeltallene til ${company.navn} på Bedriftsgrafen.no`,
      url: window.location.href,
    }

    if (navigator.share) {
      try {
        await navigator.share(shareData)
      } catch (err) {
        console.error('Error sharing:', err)
      }
    } else {
      const success = await copyToClipboard(window.location.href)
      if (success) {
        addToast('success', 'Lenke kopiert til utklippstavlen!')
      } else {
        addToast('error', 'Kunne ikke kopiere lenke')
      }
    }
  }, [company, addToast])

  return {
    copiedOrgnr,
    handleCopyOrgnr,
    handleShare
  }
}
