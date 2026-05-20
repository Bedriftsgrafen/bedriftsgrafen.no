import { useId } from 'react'
import { Modal } from '../common/Modal'
import { CompanyDetailContent, type CompanyDetailContentProps } from './CompanyDetailContent'
import type { TabType } from './ModalTabs'

interface CompanyModalProps extends Omit<CompanyDetailContentProps, 'constrainHeight'> {
  onClose: () => void
}

export type { TabType }

export function CompanyModal({ onClose, ...contentProps }: CompanyModalProps) {
  const modalId = useId()
  const headingId = `${modalId}-heading`
  const descriptionId = `${modalId}-description`

  return (
    <Modal
      isOpen={!!contentProps.company || contentProps.companyLoading || contentProps.companyError}
      onClose={onClose}
      width="w-full"
      maxWidth="max-w-7xl"
      padding={false}
      ariaLabel={contentProps.company ? undefined : 'Virksomhetsdetaljer'}
      ariaLabelledBy={contentProps.company ? headingId : undefined}
      ariaDescribedBy={contentProps.company ? descriptionId : undefined}
    >
      <CompanyDetailContent
        {...contentProps}
        constrainHeight
        headingId={headingId}
        descriptionId={descriptionId}
      />
    </Modal>
  )
}