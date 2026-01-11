import { useEffect } from 'react'

export function useDocumentTitle(title?: string) {
  useEffect(() => {
    const baseTitle = 'Bedriftsgrafen.no'
    document.title = title ? `${title} | ${baseTitle}` : baseTitle
    
    return () => {
      document.title = baseTitle
    }
  }, [title])
}
