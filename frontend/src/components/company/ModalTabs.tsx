import { TabContainer } from '../common'

export type TabType = 'oversikt' | 'okonomi' | 'sammenligning' | 'avdelinger' | 'roller'

interface TabsProps {
  activeTab: TabType
  onTabChange: (tab: TabType) => void
  hasAccountingData?: boolean
}

interface TabButtonProps {
  tab: TabType
  label: string
  isActive: boolean
  onChange: (tab: TabType) => void
}

function TabButton({ tab, label, isActive, onChange }: TabButtonProps) {
  return (
    <button
      onClick={() => onChange(tab)}
      className={`px-6 py-3 font-medium text-sm transition-colors relative whitespace-nowrap ${isActive
        ? 'text-blue-600'
        : 'text-gray-500 hover:text-gray-700'
        }`}
    >
      {label}
      {isActive && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
      )}
    </button>
  )
}

export function ModalTabs({ activeTab, onTabChange, hasAccountingData = true, isSubunit = false }: TabsProps & { isSubunit?: boolean }) {
  return (
    <TabContainer className="gap-0">
      <TabButton tab="oversikt" label="Oversikt" isActive={activeTab === 'oversikt'} onChange={onTabChange} />
      {!isSubunit && (
        <TabButton tab="okonomi" label="Økonomi" isActive={activeTab === 'okonomi'} onChange={onTabChange} />
      )}
      {hasAccountingData && !isSubunit && (
        <TabButton tab="sammenligning" label="Sammenligning" isActive={activeTab === 'sammenligning'} onChange={onTabChange} />
      )}
      {!isSubunit && (
        <TabButton tab="roller" label="Roller" isActive={activeTab === 'roller'} onChange={onTabChange} />
      )}
      {!isSubunit && (
        <TabButton tab="avdelinger" label="Avdelinger" isActive={activeTab === 'avdelinger'} onChange={onTabChange} />
      )}
    </TabContainer>
  )
}
