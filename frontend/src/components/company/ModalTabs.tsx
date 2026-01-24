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

export function ModalTabs({ activeTab, onTabChange, hasAccountingData = true }: TabsProps) {
  return (
    <div className="flex border-b border-gray-200 mb-6 overflow-x-auto no-scrollbar">
      <TabButton tab="oversikt" label="Oversikt" isActive={activeTab === 'oversikt'} onChange={onTabChange} />
      <TabButton tab="okonomi" label="Økonomi" isActive={activeTab === 'okonomi'} onChange={onTabChange} />
      {hasAccountingData && (
        <TabButton tab="sammenligning" label="Sammenligning" isActive={activeTab === 'sammenligning'} onChange={onTabChange} />
      )}
      <TabButton tab="roller" label="Roller" isActive={activeTab === 'roller'} onChange={onTabChange} />
      <TabButton tab="avdelinger" label="Avdelinger" isActive={activeTab === 'avdelinger'} onChange={onTabChange} />
    </div>
  )
}
