import { Link, useNavigate } from '@tanstack/react-router'
import { useState, useCallback, useEffect, type SyntheticEvent } from 'react'
import { Search, User, Building2, ArrowRight } from 'lucide-react'
import { useCompanySearchQuery } from '../../hooks/queries/useCompanySearchQuery'
import { usePersonSearchQuery } from '../../hooks/queries/usePersonSearchQuery'
import { useUiStore } from '../../store/uiStore'
import { useFilterStore } from '../../store/filterStore'
import { normalizeSearchQuery } from '../../utils/formatters'
import { canRunCompanySearch, getCompanySearchValidationMessage } from '../../utils/searchValidation'

const SEARCH_MODE_LABEL_ID = 'landing-search-mode-label'
const SEARCH_HELP_TEXT_ID = 'landing-search-help-text'
const COMPANY_RESULTS_ID = 'landing-company-results'
const PERSON_RESULTS_ID = 'landing-person-results'

export function HeroSearchPanel() {
    const navigate = useNavigate()
    const [searchQuery, setSearchQuery] = useState('')
    const [debouncedCompanyQuery, setDebouncedCompanyQuery] = useState('')
    const [debouncedPersonQuery, setDebouncedPersonQuery] = useState('')
    const [searchMode, setSearchMode] = useState<'company' | 'person'>('company')

    const addRecentSearch = useUiStore((s) => s.addRecentSearch)
    const clearFilters = useFilterStore((s) => s.clearFilters)
    const companySearchEnabled = searchMode === 'company' && canRunCompanySearch(searchQuery)
    const {
        data: companyResults,
        isFetching: companySearchLoading,
    } = useCompanySearchQuery(companySearchEnabled ? debouncedCompanyQuery : '', 5)
    const {
        data: personResults,
        isFetching: personSearchLoading,
    } = usePersonSearchQuery(debouncedPersonQuery, 5)

    useEffect(() => {
        if (!companySearchEnabled) {
            return
        }

        const timer = setTimeout(() => setDebouncedCompanyQuery(normalizeSearchQuery(searchQuery.trim())), 200)
        return () => clearTimeout(timer)
    }, [companySearchEnabled, searchQuery])

    useEffect(() => {
        if (searchMode !== 'person' || searchQuery.length < 3) {
            return
        }

        const timer = setTimeout(() => setDebouncedPersonQuery(searchQuery), 300)
        return () => clearTimeout(timer)
    }, [searchMode, searchQuery])

    const handleSearch = useCallback((query: string) => {
        const trimmed = normalizeSearchQuery(query.trim())
        if (!trimmed) return

        if (searchMode === 'person') {
            navigate({ to: '/person', search: { tab: 'sok' as const, q: trimmed } })
            return
        }

        if (getCompanySearchValidationMessage(trimmed)) {
            return
        }

        if (/^\d{9}$/.test(trimmed)) {
            navigate({ to: '/virksomhet/$orgnr', params: { orgnr: trimmed } })
            return
        }

        clearFilters()
        addRecentSearch(trimmed)
        navigate({ to: '/utforsk', search: { q: trimmed } })
    }, [addRecentSearch, clearFilters, navigate, searchMode])

    const handleModeChange = useCallback((mode: 'company' | 'person') => {
        setSearchMode(mode)
        setSearchQuery('')
        setDebouncedCompanyQuery('')
        setDebouncedPersonQuery('')
    }, [])

    const handleSubmit = useCallback((event: SyntheticEvent<HTMLFormElement>) => {
        event.preventDefault()

        if (!searchQuery.trim()) {
            return
        }

        handleSearch(searchQuery)
    }, [handleSearch, searchQuery])

    const companyValidationMessage = searchMode === 'company'
        ? getCompanySearchValidationMessage(searchQuery)
        : null
    const hasCompanyResults = companySearchLoading || Boolean(companyResults?.length)
    const showCompanyDropdown = searchMode === 'company' && Boolean(debouncedCompanyQuery) && hasCompanyResults
    const hasPersonResults = personSearchLoading || Boolean(personResults?.length)
    const showPersonDropdown = searchMode === 'person' && Boolean(debouncedPersonQuery) && hasPersonResults

    return (
        <div className="relative z-30 mx-auto mt-8 max-w-3xl rounded-[28px] border border-slate-300 bg-slate-100/80 p-3 shadow-[0_20px_45px_-34px_rgba(15,23,42,0.38)] transition-colors duration-300 dark:border-slate-700 dark:bg-slate-950/70 dark:shadow-[0_20px_45px_-34px_rgba(0,0,0,0.9)] sm:mt-10 sm:p-4 md:p-5">
            <div
                role="group"
                aria-labelledby={SEARCH_MODE_LABEL_ID}
                className="mx-auto mb-4 grid w-full max-w-sm grid-cols-2 rounded-full bg-white p-1.5 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700 sm:flex sm:w-auto sm:max-w-fit"
            >
                <span id={SEARCH_MODE_LABEL_ID} className="sr-only">Velg søketype</span>
                <button
                    id="search-mode-company"
                    type="button"
                    aria-pressed={searchMode === 'company'}
                    onClick={() => handleModeChange('company')}
                    className={`flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:ring-offset-2 ${
                        searchMode === 'company'
                            ? 'bg-blue-900 text-white shadow-[0_10px_20px_-14px_rgba(30,58,138,0.9)] dark:bg-blue-500 dark:text-slate-950'
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white'
                    }`}
                >
                    <Building2 aria-hidden="true" className="h-4 w-4" />
                    Virksomheter
                </button>
                <button
                    id="search-mode-person"
                    type="button"
                    aria-pressed={searchMode === 'person'}
                    onClick={() => handleModeChange('person')}
                    className={`flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:ring-offset-2 ${
                        searchMode === 'person'
                            ? 'bg-blue-900 text-white shadow-[0_10px_20px_-14px_rgba(30,58,138,0.9)] dark:bg-blue-500 dark:text-slate-950'
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white'
                    }`}
                >
                    <User aria-hidden="true" className="h-4 w-4" />
                    Personer
                </button>
            </div>

            <form
                role="search"
                aria-labelledby="hero-title"
                aria-describedby={SEARCH_HELP_TEXT_ID}
                onSubmit={handleSubmit}
                className="rounded-2xl border border-slate-300 bg-slate-50 p-2.5 shadow-[0_16px_36px_-28px_rgba(15,23,42,0.32)] transition-colors duration-300 focus-within:border-blue-800 focus-within:ring-4 focus-within:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:shadow-[0_16px_36px_-28px_rgba(0,0,0,0.9)] dark:focus-within:border-blue-400 dark:focus-within:ring-blue-400/15 sm:p-3 md:p-4"
            >
                <p id={SEARCH_HELP_TEXT_ID} className="sr-only">
                    {searchMode === 'company'
                        ? 'Søk etter virksomhet, organisasjonsnummer, bransje eller formål.'
                        : 'Søk etter navn på person. Resultater vises mens du skriver.'}
                </p>
                <div className="relative flex flex-col gap-3 md:flex-row">
                    <div className="relative flex-1">
                        <input
                            id="home-search-input"
                            aria-label="Søk etter virksomhet eller person"
                            role="combobox"
                            type="search"
                            autoComplete="off"
                            enterKeyHint="search"
                            spellCheck={false}
                            aria-autocomplete={searchMode === 'person' || searchMode === 'company' ? 'list' : 'none'}
                            aria-expanded={searchMode === 'person' ? showPersonDropdown : showCompanyDropdown}
                            aria-controls={searchMode === 'person' ? PERSON_RESULTS_ID : COMPANY_RESULTS_ID}
                            value={searchQuery}
                            onChange={(event) => {
                                const nextQuery = event.target.value
                                setSearchQuery(nextQuery)

                                if (searchMode !== 'person' || nextQuery.length < 3) {
                                    setDebouncedPersonQuery('')
                                }

                                if (searchMode !== 'company' || !canRunCompanySearch(nextQuery)) {
                                    setDebouncedCompanyQuery('')
                                }
                            }}
                            placeholder={searchMode === 'company'
                                ? 'Søk etter virksomhet, orgnr, bransje eller formål...'
                                : 'Søk etter navn på person...'}
                            className="w-full rounded-xl border-0 bg-transparent px-4 py-3.5 text-base font-medium text-slate-950 outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-slate-500 md:text-[17px]"
                        />

                        {showCompanyDropdown && (
                            <div
                                id={COMPANY_RESULTS_ID}
                                role="region"
                                aria-label="Forslag til virksomheter"
                                aria-live="polite"
                                className="absolute left-0 right-0 top-full z-100 mt-2 overflow-hidden rounded-2xl border border-slate-300 bg-white text-slate-900 shadow-[0_26px_56px_-26px_rgba(15,23,42,0.42)] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:shadow-[0_26px_56px_-26px_rgba(0,0,0,0.9)]"
                            >
                                {companySearchLoading ? (
                                    <div role="status" className="p-4 text-center text-sm text-slate-500 dark:text-slate-400">Søker...</div>
                                ) : (
                                    <ul role="list" className="max-h-72 overflow-y-auto">
                                        {companyResults?.map((company) => (
                                            <li key={company.orgnr}>
                                                <Link
                                                    to="/virksomhet/$orgnr"
                                                    params={{ orgnr: company.orgnr }}
                                                    aria-label={`Åpne ${company.navn || 'virksomhet'} (${company.orgnr})`}
                                                    className="flex items-center justify-between gap-3 border-b border-slate-100 p-4 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:ring-inset last:border-b-0 dark:border-slate-800 dark:hover:bg-white/5 dark:focus-visible:ring-blue-300"
                                                >
                                                    <div className="flex min-w-0 items-center gap-3">
                                                        <div className="rounded-xl bg-blue-50 p-2 text-blue-700 ring-1 ring-blue-100 dark:bg-blue-500/15 dark:text-blue-200 dark:ring-blue-400/20">
                                                            <Building2 aria-hidden="true" className="h-4 w-4" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="truncate font-semibold text-slate-900 dark:text-white">{company.navn || company.orgnr}</div>
                                                            <div className="text-xs text-slate-500 dark:text-slate-400">
                                                                {company.organisasjonsform ? `${company.organisasjonsform} · ` : ''}{company.orgnr}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-300 dark:text-slate-600" />
                                                </Link>
                                            </li>
                                        ))}
                                        <Link
                                            to="/utforsk"
                                            search={{ q: normalizeSearchQuery(searchQuery.trim()) }}
                                            aria-label={`Se alle virksomheter som matcher ${normalizeSearchQuery(searchQuery.trim())}`}
                                            className="flex items-center justify-center gap-2 border-t border-slate-100 p-3 text-sm font-semibold text-blue-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:ring-inset dark:border-slate-800 dark:text-blue-300 dark:hover:bg-white/5 dark:focus-visible:ring-blue-300"
                                        >
                                            Se alle resultater
                                            <ArrowRight aria-hidden="true" className="h-4 w-4" />
                                        </Link>
                                    </ul>
                                )}
                            </div>
                        )}

                        {showPersonDropdown && (
                            <div
                                id={PERSON_RESULTS_ID}
                                role="region"
                                aria-label="Forslag til personer"
                                aria-live="polite"
                                className="absolute left-0 right-0 top-full z-100 mt-2 overflow-hidden rounded-2xl border border-slate-300 bg-white text-slate-900 shadow-[0_26px_56px_-26px_rgba(15,23,42,0.42)] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:shadow-[0_26px_56px_-26px_rgba(0,0,0,0.9)]"
                            >
                                {personSearchLoading ? (
                                    <div role="status" className="p-4 text-center text-sm text-slate-500 dark:text-slate-400">Søker...</div>
                                ) : (
                                    <ul role="list" className="max-h-64 overflow-y-auto">
                                        {personResults?.map((person, index) => (
                                            <li key={`${person.name}-${index}`}>
                                                <Link
                                                    to="/person/$name/$birthdate"
                                                    params={{
                                                        name: person.name,
                                                        birthdate: person.birthdate ? person.birthdate.slice(0, 4) : 'unknown',
                                                    }}
                                                    aria-label={`${person.name}${person.birthdate ? `, fødselsår ${person.birthdate.slice(0, 4)}` : ''}. ${person.role_count} ${person.role_count === 1 ? 'rolle' : 'roller'}`}
                                                    className="flex items-center justify-between gap-3 border-b border-slate-100 p-4 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:ring-inset last:border-b-0 dark:border-slate-800 dark:hover:bg-white/5 dark:focus-visible:ring-blue-300"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="rounded-xl bg-blue-50 p-2 text-blue-700 ring-1 ring-blue-100 dark:bg-blue-500/15 dark:text-blue-200 dark:ring-blue-400/20">
                                                            <User aria-hidden="true" className="h-4 w-4" />
                                                        </div>
                                                        <div>
                                                            <div className="font-semibold text-slate-900 dark:text-white">{person.name}</div>
                                                            {person.birthdate && (
                                                                <div className="text-xs text-slate-500 dark:text-slate-400">Fødselsår: {person.birthdate.slice(0, 4)}</div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div aria-hidden="true" className="rounded-full bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                                        {person.role_count} {person.role_count === 1 ? 'rolle' : 'roller'}
                                                    </div>
                                                </Link>
                                            </li>
                                        ))}
                                        <Link
                                            to="/person"
                                            search={{ tab: 'sok' as const, q: searchQuery.trim() }}
                                            aria-label={`Se alle personer som matcher ${searchQuery.trim()}`}
                                            className="flex items-center justify-center gap-2 border-t border-slate-100 p-3 text-sm font-semibold text-blue-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:ring-inset dark:border-slate-800 dark:text-blue-300 dark:hover:bg-white/5 dark:focus-visible:ring-blue-300"
                                        >
                                            Se alle resultater
                                            <ArrowRight aria-hidden="true" className="h-4 w-4" />
                                        </Link>
                                    </ul>
                                )}
                            </div>
                        )}
                    </div>

                    <button
                        type="submit"
                        aria-label={searchMode === 'company' ? 'Søk etter virksomhet' : 'Søk etter person'}
                        disabled={Boolean(companyValidationMessage)}
                        className="inline-flex min-w-34 w-full items-center justify-center gap-2 rounded-xl bg-blue-900 px-7 py-3.5 text-[15px] font-semibold text-white shadow-[0_14px_28px_-18px_rgba(30,58,138,0.95)] transition-colors hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-blue-500 dark:text-slate-950 dark:hover:bg-blue-400 dark:focus:ring-blue-300 md:w-auto"
                    >
                        <Search aria-hidden="true" className="h-4 w-4" />
                        Søk
                    </button>
                </div>
                {companyValidationMessage && (
                    <p className="mt-2 px-2 text-sm font-medium text-slate-600 dark:text-slate-300" role="status">
                        {companyValidationMessage}
                    </p>
                )}
            </form>
        </div>
    )
}