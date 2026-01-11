import { Filter, ChevronDown, ChevronUp, Check } from 'lucide-react'
import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { useFilterStore } from '../store/filterStore'
import { useResetPagination } from '../hooks/useResetPagination'
import { useSavedFiltersStore, type SavedFilter } from '../store/savedFiltersStore'
import { toast } from '../store/toastStore'
import { ORGANIZATION_FORMS } from '../constants/organizationForms'
import {
  RangeInput,
  SavedFiltersSection,
  StatusFilters,
  OrganizationFormFilter,
  ActiveFilterChips
} from './filter'

export function FilterPanel() {
  const [isExpanded, setIsExpanded] = useState(false)
  const [saveFilterName, setSaveFilterName] = useState('')
  const [showSaveInput, setShowSaveInput] = useState(false)
  const [editingFilterId, setEditingFilterId] = useState<string | null>(null)

  // Get store values and actions
  const store = useFilterStore()
  const resetPagination = useResetPagination()
  const { savedFilters, saveFilter, updateFilter, deleteFilter } = useSavedFiltersStore()
  const activeFilters = store.getActiveFilterCount()

  // Create a stable snapshot of store values for syncing to draft state.
  // INTENTIONAL: We only depend on filterVersion, not individual fields.
  // This is because we want to capture a snapshot when filters are APPLIED
  // (which increments filterVersion), not on every keystroke during editing.
  // The draft state (draftFilters) holds the in-progress values until user clicks "Bruk filter".
  const storeSnapshot = useMemo(() => ({
    searchQuery: store.searchQuery,
    organizationForms: store.organizationForms,
    naeringskode: store.naeringskode,
    revenueMin: store.revenueMin,
    revenueMax: store.revenueMax,
    profitMin: store.profitMin,
    profitMax: store.profitMax,
    equityMin: store.equityMin,
    equityMax: store.equityMax,
    operatingProfitMin: store.operatingProfitMin,
    operatingProfitMax: store.operatingProfitMax,
    liquidityRatioMin: store.liquidityRatioMin,
    liquidityRatioMax: store.liquidityRatioMax,
    equityRatioMin: store.equityRatioMin,
    equityRatioMax: store.equityRatioMax,
    employeeMin: store.employeeMin,
    employeeMax: store.employeeMax,
    municipality: store.municipality,
    foundedFrom: store.foundedFrom,
    foundedTo: store.foundedTo,
    isBankrupt: store.isBankrupt,
    inLiquidation: store.inLiquidation,
    inForcedLiquidation: store.inForcedLiquidation,
    hasAccounting: store.hasAccounting,
    bankruptFrom: store.bankruptFrom,
    bankruptTo: store.bankruptTo,
    // eslint-disable-next-line react-hooks/exhaustive-deps -- See comment above: intentional snapshot on version change only
  }), [store.filterVersion])

  // Local draft state
  const [draftFilters, setDraftFilters] = useState(storeSnapshot)

  // Sync draft filters with store when filterVersion changes
  const prevFilterVersionRef = useRef(store.filterVersion)
  if (prevFilterVersionRef.current !== store.filterVersion) {
    prevFilterVersionRef.current = store.filterVersion
    setDraftFilters(storeSnapshot)
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // '/' to focus search
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault()
        document.getElementById('search-input')?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Handlers
  const handleOrganizationFormToggle = useCallback((value: string) => {
    setDraftFilters(prev => ({
      ...prev,
      organizationForms: prev.organizationForms.includes(value)
        ? prev.organizationForms.filter(f => f !== value)
        : [...prev.organizationForms, value]
    }))
  }, [])

  const handleRangeChange = useCallback((field: string, isMin: boolean, value: string, multiplier: number = 1) => {
    const num = value ? parseFloat(value) * multiplier : null
    const fieldKey = `${field}${isMin ? 'Min' : 'Max'}` as keyof typeof draftFilters
    setDraftFilters(prev => ({ ...prev, [fieldKey]: num }))
  }, [])

  const handleDateChange = useCallback((isFrom: boolean, value: string) => {
    const date = value ? new Date(value) : null
    setDraftFilters(prev => ({
      ...prev,
      [isFrom ? 'foundedFrom' : 'foundedTo']: date
    }))
  }, [])

  const handleBankruptDateChange = useCallback((isFrom: boolean, value: string) => {
    const date = value ? new Date(value) : null
    setDraftFilters(prev => ({
      ...prev,
      [isFrom ? 'bankruptFrom' : 'bankruptTo']: date
    }))
  }, [])

  const handleHasAccountingChange = useCallback((value: string) => {
    let hasAcc: boolean | null = null
    if (value === 'yes') hasAcc = true
    else if (value === 'no') hasAcc = false
    setDraftFilters(prev => ({ ...prev, hasAccounting: hasAcc }))
  }, [])

  const handleStatusChange = useCallback((key: 'isBankrupt' | 'inLiquidation' | 'inForcedLiquidation', value: boolean | null) => {
    setDraftFilters(prev => ({ ...prev, [key]: value }))
  }, [])

  const applyFilters = () => {
    resetPagination()
    store.setAllFilters({
      searchQuery: draftFilters.searchQuery,
      organizationForms: draftFilters.organizationForms,
      naeringskode: draftFilters.naeringskode,
      revenueMin: draftFilters.revenueMin,
      revenueMax: draftFilters.revenueMax,
      profitMin: draftFilters.profitMin,
      profitMax: draftFilters.profitMax,
      equityMin: draftFilters.equityMin,
      equityMax: draftFilters.equityMax,
      operatingProfitMin: draftFilters.operatingProfitMin,
      operatingProfitMax: draftFilters.operatingProfitMax,
      liquidityRatioMin: draftFilters.liquidityRatioMin,
      liquidityRatioMax: draftFilters.liquidityRatioMax,
      equityRatioMin: draftFilters.equityRatioMin,
      equityRatioMax: draftFilters.equityRatioMax,
      employeeMin: draftFilters.employeeMin,
      employeeMax: draftFilters.employeeMax,
      municipality: draftFilters.municipality,
      foundedFrom: draftFilters.foundedFrom,
      foundedTo: draftFilters.foundedTo,
      bankruptFrom: draftFilters.bankruptFrom,
      bankruptTo: draftFilters.bankruptTo,
      isBankrupt: draftFilters.isBankrupt,
      inLiquidation: draftFilters.inLiquidation,
      inForcedLiquidation: draftFilters.inForcedLiquidation,
      hasAccounting: draftFilters.hasAccounting,
    })
  }

  const resetFilters = () => {
    resetPagination()
    store.clearFilters()
  }

  // Saved filter helpers
  const getCurrentFiltersForSave = (): SavedFilter['filters'] => ({
    searchQuery: draftFilters.searchQuery,
    organizationForms: draftFilters.organizationForms,
    naeringskode: draftFilters.naeringskode,
    revenueMin: draftFilters.revenueMin,
    revenueMax: draftFilters.revenueMax,
    profitMin: draftFilters.profitMin,
    profitMax: draftFilters.profitMax,
    equityMin: draftFilters.equityMin,
    equityMax: draftFilters.equityMax,
    operatingProfitMin: draftFilters.operatingProfitMin,
    operatingProfitMax: draftFilters.operatingProfitMax,
    liquidityRatioMin: draftFilters.liquidityRatioMin,
    liquidityRatioMax: draftFilters.liquidityRatioMax,
    equityRatioMin: draftFilters.equityRatioMin,
    equityRatioMax: draftFilters.equityRatioMax,
    employeeMin: draftFilters.employeeMin,
    employeeMax: draftFilters.employeeMax,
    municipality: draftFilters.municipality,
    foundedFrom: draftFilters.foundedFrom?.toISOString() ?? null,
    foundedTo: draftFilters.foundedTo?.toISOString() ?? null,
    isBankrupt: draftFilters.isBankrupt,
    inLiquidation: draftFilters.inLiquidation,
    inForcedLiquidation: draftFilters.inForcedLiquidation,
    hasAccounting: draftFilters.hasAccounting,
    bankruptFrom: draftFilters.bankruptFrom?.toISOString() ?? null,
    bankruptTo: draftFilters.bankruptTo?.toISOString() ?? null,
  })

  const filterNameExists = (name: string, excludeId?: string) => {
    return savedFilters.some(f => f.name.toLowerCase() === name.toLowerCase() && f.id !== excludeId)
  }

  const handleSaveFilter = () => {
    const name = saveFilterName.trim()
    if (!name) return
    if (filterNameExists(name)) {
      toast.warning(`Et filter med navnet "${name}" finnes allerede`)
      return
    }
    saveFilter(name, getCurrentFiltersForSave())
    toast.success(`Filter "${name}" lagret`)
    setSaveFilterName('')
    setShowSaveInput(false)
  }

  const handleUpdateFilter = (filterId: string, filterName: string) => {
    updateFilter(filterId, filterName, getCurrentFiltersForSave())
    toast.success(`Filter "${filterName}" oppdatert`)
    setEditingFilterId(null)
  }

  const loadSavedFilter = (filter: SavedFilter) => {
    setEditingFilterId(filter.id)
    setDraftFilters({
      searchQuery: filter.filters.searchQuery ?? '',
      organizationForms: filter.filters.organizationForms ?? [],
      naeringskode: filter.filters.naeringskode ?? '',
      revenueMin: filter.filters.revenueMin ?? null,
      revenueMax: filter.filters.revenueMax ?? null,
      profitMin: filter.filters.profitMin ?? null,
      profitMax: filter.filters.profitMax ?? null,
      equityMin: filter.filters.equityMin ?? null,
      equityMax: filter.filters.equityMax ?? null,
      operatingProfitMin: filter.filters.operatingProfitMin ?? null,
      operatingProfitMax: filter.filters.operatingProfitMax ?? null,
      liquidityRatioMin: filter.filters.liquidityRatioMin ?? null,
      liquidityRatioMax: filter.filters.liquidityRatioMax ?? null,
      equityRatioMin: filter.filters.equityRatioMin ?? null,
      equityRatioMax: filter.filters.equityRatioMax ?? null,
      employeeMin: filter.filters.employeeMin ?? null,
      employeeMax: filter.filters.employeeMax ?? null,
      municipality: filter.filters.municipality ?? '',
      foundedFrom: filter.filters.foundedFrom ? new Date(filter.filters.foundedFrom) : null,
      foundedTo: filter.filters.foundedTo ? new Date(filter.filters.foundedTo) : null,
      isBankrupt: filter.filters.isBankrupt ?? null,
      inLiquidation: filter.filters.inLiquidation ?? null,
      inForcedLiquidation: filter.filters.inForcedLiquidation ?? null,
      bankruptFrom: filter.filters.bankruptFrom ? new Date(filter.filters.bankruptFrom) : null,
      bankruptTo: filter.filters.bankruptTo ? new Date(filter.filters.bankruptTo) : null,
      hasAccounting: filter.filters.hasAccounting ?? null,
    })
  }

  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-200 mb-8">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-5 flex items-center justify-between bg-blue-50 hover:bg-blue-100 transition-colors rounded-t-xl"
      >
        <div className="flex items-center gap-3">
          <Filter className="h-5 w-5 text-blue-600" />
          <h2 className="font-semibold text-lg text-gray-900">Filtrer bedrifter</h2>
          {activeFilters > 0 && (
            <>
              <span className="px-2.5 py-0.5 bg-blue-600 text-white text-sm font-medium rounded-full">
                {activeFilters}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); resetFilters() }}
                className="px-2 py-0.5 bg-gray-200 hover:bg-red-100 text-gray-600 hover:text-red-600 text-xs font-medium rounded-full transition-colors"
                title="Nullstill alle filtre"
              >
                Nullstill
              </button>
            </>
          )}
        </div>
        {isExpanded ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
      </button>

      {/* Filter Content */}
      {isExpanded && (
        <div className="p-5 pt-0 border-t border-gray-100">
          {/* Saved Filters */}
          <SavedFiltersSection
            savedFilters={savedFilters}
            showSaveInput={showSaveInput}
            saveFilterName={saveFilterName}
            editingFilterId={editingFilterId}
            onShowSaveInput={() => setShowSaveInput(true)}
            onHideSaveInput={() => setShowSaveInput(false)}
            onSaveFilterNameChange={setSaveFilterName}
            onSaveFilter={handleSaveFilter}
            onLoadFilter={loadSavedFilter}
            onUpdateFilter={handleUpdateFilter}
            onDeleteFilter={(id) => { deleteFilter(id); if (editingFilterId === id) setEditingFilterId(null) }}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Column 1: Company Info */}
            <div className="space-y-6">
              <h3 className="font-medium text-gray-900 border-b pb-2">Bedriftsinformasjon</h3>

              {/* Sorting */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Sortering</label>
                <div className="flex gap-2">
                  <select
                    value={store.sortBy}
                    onChange={(e) => store.setSort(e.target.value, store.sortOrder)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white"
                  >
                    <option value="navn">Navn</option>
                    <option value="antall_ansatte">Antall ansatte</option>
                    <option value="revenue">Omsetning</option>
                    <option value="profit">Årsresultat</option>
                    <option value="operating_profit">Driftsresultat</option>
                    <option value="stiftelsesdato">Stiftelsesdato</option>
                  </select>
                  <select
                    value={store.sortOrder}
                    onChange={(e) => store.setSort(store.sortBy, e.target.value as 'asc' | 'desc')}
                    className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white"
                  >
                    <option value="asc">Stigende</option>
                    <option value="desc">Synkende</option>
                  </select>
                </div>
              </div>

              {/* Search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fritekst-søk <span className="text-xs text-gray-400 font-normal ml-1">(Trykk '/' for å søke)</span>
                </label>
                <div className="relative">
                  <input
                    id="search-input"
                    type="text"
                    placeholder="Søk navn eller org.nr..."
                    value={draftFilters.searchQuery}
                    onChange={(e) => setDraftFilters(prev => ({ ...prev, searchQuery: e.target.value }))}
                    onKeyDown={(e) => {
                      // Prevent '/' from being typed if it was the shortcut key (though usually handled by preventDefault in shortcut listener)
                      // But here we handle Enter
                      if (e.key === 'Enter') {
                        applyFilters();
                        document.getElementById('company-table')?.scrollIntoView({ behavior: 'smooth' })
                      }
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-8"
                  />
                  {draftFilters.searchQuery && (
                    <button
                      onClick={() => setDraftFilters(prev => ({ ...prev, searchQuery: '' }))}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                      aria-label="Tøm søkefelt"
                    >
                      <span className="text-lg leading-none">&times;</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Organization Form */}
              <OrganizationFormFilter
                selectedForms={draftFilters.organizationForms}
                options={ORGANIZATION_FORMS}
                onToggle={handleOrganizationFormToggle}
                onSelectAll={() => setDraftFilters(prev => ({ ...prev, organizationForms: ORGANIZATION_FORMS.map(f => f.value) }))}
                onClearAll={() => setDraftFilters(prev => ({ ...prev, organizationForms: [] }))}
              />

              {/* Industry Code */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Næringskode (kode eller start)</label>
                <input
                  type="text"
                  placeholder="F.eks. 62.100"
                  value={draftFilters.naeringskode}
                  onChange={(e) => setDraftFilters(prev => ({ ...prev, naeringskode: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              {/* Municipality */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kommune</label>
                <input
                  type="text"
                  placeholder="F.eks. Oslo"
                  value={draftFilters.municipality}
                  onChange={(e) => setDraftFilters(prev => ({ ...prev, municipality: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              {/* Employees */}
              <RangeInput
                label="Antall ansatte"
                fieldName="employee"
                minValue={draftFilters.employeeMin}
                maxValue={draftFilters.employeeMax}
                onChange={handleRangeChange}
              />

              {/* Founded Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stiftelsesdato</label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={draftFilters.foundedFrom?.toISOString().split('T')[0] || ''}
                    onChange={(e) => handleDateChange(true, e.target.value)}
                    className="w-1/2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  />
                  <input
                    type="date"
                    value={draftFilters.foundedTo?.toISOString().split('T')[0] || ''}
                    onChange={(e) => handleDateChange(false, e.target.value)}
                    className="w-1/2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  />
                </div>
              </div>

              {/* Bankrupt Date - ADDED */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Konkursdato</label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={draftFilters.bankruptFrom?.toISOString().split('T')[0] || ''}
                    onChange={(e) => handleBankruptDateChange(true, e.target.value)}
                    className="w-1/2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  />
                  <input
                    type="date"
                    value={draftFilters.bankruptTo?.toISOString().split('T')[0] || ''}
                    onChange={(e) => handleBankruptDateChange(false, e.target.value)}
                    className="w-1/2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Column 2: Financials */}
            <div className="space-y-6">
              <h3 className="font-medium text-gray-900 border-b pb-2">Økonomi (siste år)</h3>

              {/* Has Accounting */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Regnskapsdata</label>
                <div className="flex gap-4">
                  {[{ value: 'all', label: 'Alle' }, { value: 'yes', label: 'Med regnskap' }, { value: 'no', label: 'Uten regnskap' }]
                    .map(opt => (
                      <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="hasAcc"
                          checked={draftFilters.hasAccounting === (opt.value === 'yes' ? true : opt.value === 'no' ? false : null)}
                          onChange={() => handleHasAccountingChange(opt.value)}
                          className="text-blue-600"
                        />
                        <span className="text-sm">{opt.label}</span>
                      </label>
                    ))}
                </div>
              </div>

              <RangeInput label="Driftsinntekter (mill. kr)" fieldName="revenue" minValue={draftFilters.revenueMin} maxValue={draftFilters.revenueMax} onChange={handleRangeChange} multiplier={1000000} />
              <RangeInput label="Årsresultat (mill. kr)" fieldName="profit" minValue={draftFilters.profitMin} maxValue={draftFilters.profitMax} onChange={handleRangeChange} multiplier={1000000} />
              <RangeInput label="Egenkapital (mill. kr)" fieldName="equity" minValue={draftFilters.equityMin} maxValue={draftFilters.equityMax} onChange={handleRangeChange} multiplier={1000000} />
              <RangeInput label="Driftsresultat (mill. kr)" fieldName="operatingProfit" minValue={draftFilters.operatingProfitMin} maxValue={draftFilters.operatingProfitMax} onChange={handleRangeChange} multiplier={1000000} />
            </div>

            {/* Column 3: Key Ratios & Status */}
            <div className="space-y-6">
              <h3 className="font-medium text-gray-900 border-b pb-2">Nøkkeltall & Status</h3>
              <RangeInput label="Likviditetsgrad" fieldName="liquidityRatio" minValue={draftFilters.liquidityRatioMin} maxValue={draftFilters.liquidityRatioMax} onChange={handleRangeChange} step="0.1" />
              <RangeInput label="Egenkapitalandel (0-1)" fieldName="equityRatio" minValue={draftFilters.equityRatioMin} maxValue={draftFilters.equityRatioMax} onChange={handleRangeChange} step="0.1" />
              <StatusFilters
                isBankrupt={draftFilters.isBankrupt}
                inLiquidation={draftFilters.inLiquidation}
                inForcedLiquidation={draftFilters.inForcedLiquidation}
                onStatusChange={handleStatusChange}
              />
            </div>
          </div>

          {/* Active Filters Summary */}
          {activeFilters > 0 && (
            <ActiveFilterChips
              searchQuery={store.searchQuery}
              organizationForms={store.organizationForms}
              naeringskode={store.naeringskode}
              municipality={store.municipality}
              county={store.county || ''}
              revenueMin={store.revenueMin}
              revenueMax={store.revenueMax}
              profitMin={store.profitMin}
              profitMax={store.profitMax}
              equityMin={store.equityMin}
              equityMax={store.equityMax}
              employeeMin={store.employeeMin}
              employeeMax={store.employeeMax}
              foundedFrom={store.foundedFrom}
              foundedTo={store.foundedTo}
              bankruptFrom={store.bankruptFrom}
              bankruptTo={store.bankruptTo}
              isBankrupt={store.isBankrupt}
              inLiquidation={store.inLiquidation}
              inForcedLiquidation={store.inForcedLiquidation}
              onClearSearch={() => { store.setSearchQuery(''); setDraftFilters(prev => ({ ...prev, searchQuery: '' })) }}
            />
          )}

          {/* Action Buttons */}
          <div className="mt-8 pt-6 border-t border-gray-200 flex gap-4 justify-end">
            <button
              onClick={resetFilters}
              className="px-6 py-2.5 font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors shadow-md hover:shadow-lg"
            >
              Nullstill
            </button>
            <button
              onClick={applyFilters}
              className="px-8 py-2.5 font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-md hover:shadow-lg flex items-center gap-2"
            >
              <Check className="h-5 w-5" />
              Bruk filter
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
