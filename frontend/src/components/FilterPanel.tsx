import { Filter, ChevronDown, Check } from 'lucide-react'
import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { useFilterStore } from '../store/filterStore'
import { useResetPagination } from '../hooks/useResetPagination'
import { useSavedFiltersStore, type SavedFilter } from '../store/savedFiltersStore'
import { toast } from '../store/toastStore'
import {
  ActiveFilterChips,
  BasisFilters,
  FinancialFilters,
  StatusAndDateFilters,
  SavedFiltersSection
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
    if (s.foundedFrom !== null || s.foundedTo !== null) count++
    if (s.bankruptFrom !== null || s.bankruptTo !== null) count++
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
      municipalityCode: s.municipalityCode,
      county: s.county,
      countyCode: s.countyCode,
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
    municipalityCode: draftFilters.municipalityCode,
    county: draftFilters.county || '',
    countyCode: draftFilters.countyCode || '',
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
      municipalityCode: filter.filters.municipalityCode ?? '',
      county: filter.filters.county ?? '',
      countyCode: filter.filters.countyCode ?? '',
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
        className="w-full p-6 flex items-center justify-between bg-linear-to-br from-slate-50 to-white hover:from-slate-100 hover:to-slate-50 transition-all duration-300 cursor-pointer select-none border-b border-transparent"
        aria-expanded={isExpanded}
      >
        {headerControls}
        <div className={`p-1 rounded-full transition-all duration-300 ${isExpanded ? 'bg-blue-100 text-blue-600 rotate-180' : 'bg-slate-100 text-slate-400'}`}>
          <ChevronDown className="h-4 w-4" />
        </div>
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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-10">
            <BasisFilters
              draftFilters={draftFilters}
              setDraftFilters={setDraftFilters}
              searchInputRef={searchInputRef}
              applyFilters={applyFilters}
            />

            <FinancialFilters
              draftFilters={draftFilters}
              handleRangeChange={handleRangeChange}
              handleHasAccountingChange={handleHasAccountingChange}
            />

            <StatusAndDateFilters
              draftFilters={draftFilters}
              handleRangeChange={handleRangeChange}
              handleDateChange={handleDateChange}
              handleBankruptDateChange={handleBankruptDateChange}
              handleStatusChange={handleStatusChange}
            />
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
                className="px-5 py-2 text-sm font-medium text-gray-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all"
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
