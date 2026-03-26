import { Modal } from '../common/Modal'
import { CompanyDetailContent, type CompanyDetailContentProps } from './CompanyDetailContent'
import type { TabType } from './ModalTabs'

interface CompanyModalProps extends Omit<CompanyDetailContentProps, 'constrainHeight'> {
  onClose: () => void
}

export type { TabType }

export function CompanyModal({ onClose, ...contentProps }: CompanyModalProps) {
  return (
    <Modal
      isOpen={!!contentProps.company || contentProps.companyLoading || contentProps.companyError}
      onClose={onClose}
      width="w-full"
      maxWidth="max-w-7xl"
      padding={false}
    >
      <CompanyDetailContent {...contentProps} constrainHeight />
    </Modal>
  )
}