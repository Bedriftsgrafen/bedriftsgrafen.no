/* eslint-disable react-refresh/only-export-components */
import { createLazyFileRoute, useNavigate } from '@tanstack/react-router'
import { useCallback } from 'react'
import { BarChart3, Trophy, Search } from 'lucide-react'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { usePersonToplistsQuery } from '../hooks/queries/usePersonToplistsQuery'
import { usePersonStatsQuery } from '../hooks/queries/usePersonStatsQuery'
import { TabContainer } from '../components/common/TabContainer'
import { TabButton } from '../components/common/TabButton'
import { PersonLandingHero } from '../components/person/PersonLandingHero'
import { PersonOverviewTab } from '../components/person/PersonOverviewTab'
import { PersonToplistTab } from '../components/person/PersonToplistTab'
import { PersonSearchTab } from '../components/person/PersonSearchTab'
import type { ToplistCategory } from '../types/person'

export const Route = createLazyFileRoute('/person/')({
    component: PersonLandingPage,
})

function PersonLandingPage() {
    useDocumentTitle('Personer')

    const { tab = 'oversikt', category = 'active_roles' } = Route.useSearch()
    const navigate = useNavigate()

    const { data: toplists = [], isLoading: toplistsLoading } = usePersonToplistsQuery()
    const { data: stats, isLoading: statsLoading } = usePersonStatsQuery()

    const setTab = useCallback(
        (newTab: 'oversikt' | 'topplister' | 'sok') => {
            navigate({
                to: '/person',
                search: (prev) => ({ ...prev, tab: newTab }),
                replace: true,
            })
        },
        [navigate]
    )

    const setCategory = useCallback(
        (newCategory: ToplistCategory) => {
            navigate({
                to: '/person',
                search: (prev) => ({ ...prev, tab: 'topplister' as const, category: newCategory }),
                replace: true,
            })
        },
        [navigate]
    )

    const loading = toplistsLoading || statsLoading

    return (
        <div className="mx-auto max-w-7xl px-4 py-8">
            <PersonLandingHero stats={stats} loading={statsLoading} />

            <TabContainer>
                <TabButton
                    active={tab === 'oversikt'}
                    icon={<BarChart3 className="h-4 w-4" />}
                    label="Oversikt"
                    onClick={() => setTab('oversikt')}
                />
                <TabButton
                    active={tab === 'topplister'}
                    icon={<Trophy className="h-4 w-4" />}
                    label="Topplister"
                    onClick={() => setTab('topplister')}
                />
                <TabButton
                    active={tab === 'sok'}
                    icon={<Search className="h-4 w-4" />}
                    label="Søk"
                    onClick={() => setTab('sok')}
                />
            </TabContainer>

            {loading && !toplists.length ? (
                <div className="flex justify-center py-12">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
                </div>
            ) : (
                <>
                    {tab === 'oversikt' && (
                        <PersonOverviewTab
                            toplists={toplists}
                            stats={stats}
                            onTabChange={setTab}
                        />
                    )}
                    {tab === 'topplister' && (
                        <PersonToplistTab
                            toplists={toplists}
                            selectedCategory={category as ToplistCategory}
                            onCategoryChange={setCategory}
                        />
                    )}
                    {tab === 'sok' && <PersonSearchTab />}
                </>
            )}
        </div>
    )
}
