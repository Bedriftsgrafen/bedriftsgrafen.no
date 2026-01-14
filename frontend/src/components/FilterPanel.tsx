import { Filter, ChevronDown, ChevronUp, Check, X } from 'lucide-react'
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

  // Refs for DOM access
  const searchInputRef = useRef<HTMLInputElement>(null)
  const tableRef = useRef<HTMLElement | null>(null)

  // Get actions from store (stable)
  const setAllFilters = useFilterStore(s => s.setAllFilters)
  const clearFilters = useFilterStore(s => s.clearFilters)
  const filterVersion = useFilterStore(s => s.filterVersion)
  // Compute active filter count inline (don't call getActiveFilterCount as it uses get() internally)
  const activeFilters = useFilterStore(s => {
    let count = 0
    if (s.searchQuery) count++
    if (s.organizationForms.length > 0) count++
    if (s.naeringskode) count++
    if (s.revenueMin !== null || s.revenueMax !== null) count++
    if (s.profitMin !== null || s.profitMax !== null) count++
    if (s.equityMin !== null || s.equityMax !== null) count++
    if (s.employeeMin !== null || s.employeeMax !== null) count++
    if (s.municipality) count++
    if (s.county) count++
    if (s.isBankrupt !== null) count++
    if (s.inLiquidation !== null) count++
    if (s.inForcedLiquidation !== null) count++
    if (s.hasAccounting !== null) count++
    return count
  })

  const resetPagination = useResetPagination()
  const { savedFilters, saveFilter, updateFilter, deleteFilter } = useSavedFiltersStore()

  // Initialize table ref on mount
  useEffect(() => {
    tableRef.current = document.getElementById('company-table')
  }, [])

  // Optimized snapshot function (does not trigger re-render on its own)
  const getStoreSnapshot = useCallback(() => {
    const s = useFilterStore.getState()
    return {
      searchQuery: s.searchQuery,
      organizationForms: s.organizationForms,
      naeringskode: s.naeringskode,
      revenueMin: s.revenueMin,
      revenueMax: s.revenueMax,
      profitMin: s.profitMin,
      profitMax: s.profitMax,
      equityMin: s.equityMin,
      equityMax: s.equityMax,
      operatingProfitMin: s.operatingProfitMin,
      operatingProfitMax: s.operatingProfitMax,
      liquidityRatioMin: s.liquidityRatioMin,
      liquidityRatioMax: s.liquidityRatioMax,
      equityRatioMin: s.equityRatioMin,
      equityRatioMax: s.equityRatioMax,
      employeeMin: s.employeeMin,
      employeeMax: s.employeeMax,
      municipality: s.municipality,
      county: s.county,
      foundedFrom: s.foundedFrom,
      foundedTo: s.foundedTo,
      isBankrupt: s.isBankrupt,
      inLiquidation: s.inLiquidation,
      inForcedLiquidation: s.inForcedLiquidation,
      hasAccounting: s.hasAccounting,
      bankruptFrom: s.bankruptFrom,
      bankruptTo: s.bankruptTo,
      sortBy: s.sortBy,
      sortOrder: s.sortOrder,
    }
  }, [])

  // Local draft state initialized once
  const [draftFilters, setDraftFilters] = useState(getStoreSnapshot)

  // Sync draft filters when filterVersion changes (e.g. on Apply or Reset)
  // Using useEffect instead of render-time setState to prevent infinite loops
  const prevVersionRef = useRef(filterVersion)
  useEffect(() => {
    if (prevVersionRef.current !== filterVersion) {
      prevVersionRef.current = filterVersion
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDraftFilters(getStoreSnapshot())
    }
  }, [filterVersion, getStoreSnapshot])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // '/' to focus search
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Handlers (using draft state)
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

  const applyFilters = useCallback(() => {
    resetPagination()
    setAllFilters({ ...draftFilters })
    tableRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [resetPagination, setAllFilters, draftFilters])

  const resetFilters = useCallback(() => {
    resetPagination()
    clearFilters() // This increments filterVersion, triggering the sync effect
  }, [resetPagination, clearFilters])

  // Saved filter helpers
  const getCurrentFiltersForSave = useCallback((): SavedFilter['filters'] => ({
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
    county: draftFilters.county || '',
    foundedFrom: draftFilters.foundedFrom?.toISOString() ?? null,
    foundedTo: draftFilters.foundedTo?.toISOString() ?? null,
    isBankrupt: draftFilters.isBankrupt,
    inLiquidation: draftFilters.inLiquidation,
    inForcedLiquidation: draftFilters.inForcedLiquidation,
    hasAccounting: draftFilters.hasAccounting,
    bankruptFrom: draftFilters.bankruptFrom?.toISOString() ?? null,
    bankruptTo: draftFilters.bankruptTo?.toISOString() ?? null,
  }), [draftFilters])

  const handleSaveFilter = useCallback(() => {
    const name = saveFilterName.trim()
    if (!name) return

    const exists = savedFilters.some(f => f.name.toLowerCase() === name.toLowerCase())
    if (exists) {
      toast.warning(`Et filter med navnet "${name}" finnes allerede`)
      return
    }

    saveFilter(name, getCurrentFiltersForSave())
    toast.success(`Filter "${name}" lagret`)
    setSaveFilterName('')
    setShowSaveInput(false)
  }, [saveFilterName, savedFilters, saveFilter, getCurrentFiltersForSave])

  const handleUpdateFilter = useCallback((filterId: string, filterName: string) => {
    updateFilter(filterId, filterName, getCurrentFiltersForSave())
    toast.success(`Filter "${filterName}" oppdatert`)
    setEditingFilterId(null)
  }, [updateFilter, getCurrentFiltersForSave])

  const loadSavedFilter = useCallback((filter: SavedFilter) => {
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
      county: filter.filters.county ?? '',
      foundedFrom: filter.filters.foundedFrom ? new Date(filter.filters.foundedFrom) : null,
      foundedTo: filter.filters.foundedTo ? new Date(filter.filters.foundedTo) : null,
      isBankrupt: filter.filters.isBankrupt ?? null,
      inLiquidation: filter.filters.inLiquidation ?? null,
      inForcedLiquidation: filter.filters.inForcedLiquidation ?? null,
      bankruptFrom: filter.filters.bankruptFrom ? new Date(filter.filters.bankruptFrom) : null,
      bankruptTo: filter.filters.bankruptTo ? new Date(filter.filters.bankruptTo) : null,
      hasAccounting: filter.filters.hasAccounting ?? null,
      sortBy: draftFilters.sortBy, // Retain current sort unless explicitly changed
      sortOrder: draftFilters.sortOrder,
    })
  }, [draftFilters.sortBy, draftFilters.sortOrder])

  const headerControls = useMemo(() => (
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
  ), [activeFilters, resetFilters])

  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-200 mb-8 overflow-hidden">
      {/* Header Toggle */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsExpanded(!isExpanded)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setIsExpanded(!isExpanded)
          }
        }}
        className="w-full p-5 flex items-center justify-between bg-blue-50/50 hover:bg-blue-50 transition-colors cursor-pointer select-none"
        aria-expanded={isExpanded}
      >
        {headerControls}
        {isExpanded ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
      </div>

      {/* Collapsible Content */}
      {isExpanded && (
        <div className="p-6 space-y-8 border-t border-gray-100">
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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-8">
            {/* Column 1: Core Filters */}
            <section className="space-y-6">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider border-b pb-2">Basis</h3>

              {/* Sorting - Now bound to draftFilters */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Sortering</label>
                <div className="grid grid-cols-5 gap-2">
                  <select
                    value={draftFilters.sortBy}
                    onChange={(e) => setDraftFilters(prev => ({ ...prev, sortBy: e.target.value }))}
                    className="col-span-3 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white"
                  >
                    <option value="navn">Navn</option>
                    <option value="antall_ansatte">Antall ansatte</option>
                    <option value="revenue">Omsetning</option>
                    <option value="profit">Årsresultat</option>
                    <option value="operating_profit">Driftsresultat</option>
                    <option value="stiftelsesdato">Stiftelsesdato</option>
                  </select>
                  <select
                    value={draftFilters.sortOrder}
                    onChange={(e) => setDraftFilters(prev => ({ ...prev, sortOrder: e.target.value as 'asc' | 'desc' }))}
                    className="col-span-2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white"
                  >
                    <option value="asc">Stigende</option>
                    <option value="desc">Synkende</option>
                  </select>
                </div>
              </div>

              {/* Search */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Fritekst-søk <span className="text-[10px] text-gray-400 font-normal ml-1">('/')</span>
                </label>
                <div className="relative">
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Søk navn eller org.nr..."
                    value={draftFilters.searchQuery}
                    onChange={(e) => setDraftFilters(prev => ({ ...prev, searchQuery: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all pr-10"
                  />
                  {draftFilters.searchQuery && (
                    <button
                      onClick={() => setDraftFilters(prev => ({ ...prev, searchQuery: '' }))}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"
                      aria-label="Tøm felt"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              <OrganizationFormFilter
                selectedForms={draftFilters.organizationForms}
                options={ORGANIZATION_FORMS}
                onToggle={handleOrganizationFormToggle}
                onSelectAll={() => setDraftFilters(prev => ({ ...prev, organizationForms: ORGANIZATION_FORMS.map(f => f.value) }))}
                onClearAll={() => setDraftFilters(prev => ({ ...prev, organizationForms: [] }))}
              />

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Næringskode</label>
                <input
                  type="text"
                  placeholder="F.eks. 62.100"
                  value={draftFilters.naeringskode}
                  onChange={(e) => setDraftFilters(prev => ({ ...prev, naeringskode: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Kommune</label>
                <input
                  type="text"
                  placeholder="F.eks. Oslo"
                  value={draftFilters.municipality}
                  onChange={(e) => setDraftFilters(prev => ({ ...prev, municipality: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                />
              </div>
            </section>

            {/* Column 2: Financials */}
            <section className="space-y-6">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider border-b pb-2">Økonomi</h3>

              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">Regnskapsdata</label>
                <div className="flex gap-4 p-1 bg-gray-50 rounded-lg">
                  {[{ value: 'all', label: 'Alle' }, { value: 'yes', label: 'Med' }, { value: 'no', label: 'Uten' }]
                    .map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => handleHasAccountingChange(opt.value)}
                        className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${draftFilters.hasAccounting === (opt.value === 'yes' ? true : opt.value === 'no' ? false : null)
                          ? 'bg-white shadow-sm text-blue-600 ring-1 ring-gray-200'
                          : 'text-gray-500 hover:text-gray-700'
                          }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                </div>
              </div>

              <RangeInput label="Omsetning (mill. kr)" fieldName="revenue" minValue={draftFilters.revenueMin} maxValue={draftFilters.revenueMax} onChange={handleRangeChange} multiplier={1000000} />
              <RangeInput label="Årsresultat (mill. kr)" fieldName="profit" minValue={draftFilters.profitMin} maxValue={draftFilters.profitMax} onChange={handleRangeChange} multiplier={1000000} />
              <RangeInput label="Egenkapital (mill. kr)" fieldName="equity" minValue={draftFilters.equityMin} maxValue={draftFilters.equityMax} onChange={handleRangeChange} multiplier={1000000} />
              <RangeInput label="Driftsresultat (mill. kr)" fieldName="operatingProfit" minValue={draftFilters.operatingProfitMin} maxValue={draftFilters.operatingProfitMax} onChange={handleRangeChange} multiplier={1000000} />
            </section>

            {/* Column 3: Advanced & Meta */}
            <section className="space-y-6">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider border-b pb-2">Status & Dato</h3>

              <RangeInput label="Ansatte" fieldName="employee" minValue={draftFilters.employeeMin} maxValue={draftFilters.employeeMax} onChange={handleRangeChange} />
              <RangeInput label="Likviditetsgrad" fieldName="liquidityRatio" minValue={draftFilters.liquidityRatioMin} maxValue={draftFilters.liquidityRatioMax} onChange={handleRangeChange} step="0.1" />
              <RangeInput label="EK-andel (0-1)" fieldName="equityRatio" minValue={draftFilters.equityRatioMin} maxValue={draftFilters.equityRatioMax} onChange={handleRangeChange} step="0.1" />

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Stiftelsesdato</label>
                  <input
                    type="date"
                    value={draftFilters.foundedFrom?.toISOString().split('T')[0] || ''}
                    onChange={(e) => handleDateChange(true, e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none text-xs"
                  />
                  <input
                    type="date"
                    value={draftFilters.foundedTo?.toISOString().split('T')[0] || ''}
                    onChange={(e) => handleDateChange(false, e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none text-xs"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Konkursdato</label>
                  <input
                    type="date"
                    value={draftFilters.bankruptFrom?.toISOString().split('T')[0] || ''}
                    onChange={(e) => handleBankruptDateChange(true, e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none text-xs"
                  />
                  <input
                    type="date"
                    value={draftFilters.bankruptTo?.toISOString().split('T')[0] || ''}
                    onChange={(e) => handleBankruptDateChange(false, e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none text-xs"
                  />
                </div>
              </div>

              <StatusFilters
                isBankrupt={draftFilters.isBankrupt}
                inLiquidation={draftFilters.inLiquidation}
                inForcedLiquidation={draftFilters.inForcedLiquidation}
                onStatusChange={handleStatusChange}
              />
            </section>
          </div>

          {/* Active Chips Dashboard */}
          {activeFilters > 0 && (
            <div className="pt-4">
              <ActiveFilterChips />
            </div>
          )}

          {/* Footer Actions */}
          <footer className="pt-6 border-t border-gray-100 flex items-center justify-between">
            <div className="text-xs text-gray-400">
              Tips: Hold Shift + Enter for å lagre filteret direkte.
            </div>
            <div className="flex gap-3">
              <button
                onClick={resetFilters}
                className="px-5 py-2 text-sm font-medium text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
              >
                Nullstill alle
              </button>
              <button
                onClick={applyFilters}
                className="px-8 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-all shadow-md hover:shadow-blue-200 flex items-center gap-2"
              >
                <Check className="h-4 w-4" />
                Bruk filter
              </button>
            </div>
          </footer>
        </div>
      )}
    </div>
  )
}
