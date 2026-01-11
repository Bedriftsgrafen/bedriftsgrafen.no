import { useEffect, RefObject } from 'react'

interface UseKeyboardShortcutsProps {
  searchInputRef: RefObject<HTMLInputElement | null>
  isModalOpen: boolean
  onCloseModal: () => void
}

export function useKeyboardShortcuts({
  searchInputRef,
  isModalOpen,
  onCloseModal,
}: UseKeyboardShortcutsProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Slash (/) to focus search - don't trigger if already typing
      if (e.key === '/' && !isModalOpen && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }

      // Escape to close modal
      if (e.key === 'Escape' && isModalOpen) {
        onCloseModal()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [searchInputRef, isModalOpen, onCloseModal])
}
