import {
  Building2,
  TrendingUp,
  ShieldCheck,
  UserCheck,
  Zap,
  MapPin,
  Info
} from 'lucide-react'
import type { ComponentType } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useStatsQuery } from '../hooks/queries/useStatsQuery'
import { useCompanyCountQuery } from '../hooks/queries/useCompanyCountQuery'
import { formatLargeNumber } from '../utils/formatters'

interface StatCard {
  title: string
  value: number | string
  icon: ComponentType<{ className?: string }>
  color: string
  bgColor: string
  href?: string
  onClick?: () => void
  tooltip: string
  isCurrency?: boolean
  isPercentage?: boolean
}

export function StatisticsCards() {
  const navigate = useNavigate()
  const { data: stats, isLoading: statsLoading } = useStatsQuery()
  const { data: totalCount } = useCompanyCountQuery({})

  const isLoading = statsLoading

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-8 mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-20 mb-1"></div>
            <div className="h-6 bg-gray-200 rounded w-16"></div>
          </div>
        ))}
      </div>
    )
  }

  if (!stats) return null

  const focusSearch = (mode: 'company' | 'person') => {
    // Scroll to search section first if needed
    const searchModeBtn = document.getElementById(`search-mode-${mode}`)
    const searchInput = document.getElementById('home-search-input')

    if (searchModeBtn) searchModeBtn.click()
    if (searchInput) {
      searchInput.focus()
      // Smooth scroll to the input area to make it obvious
      searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  const cards: StatCard[] = [
    {
      title: 'Bedriftspopulasjonen',
      value: totalCount ?? stats.total_companies,
      icon: Building2,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      onClick: () => focusSearch('company'),
      tooltip: 'Søk i alle norske bedrifter'
    },
    {
      title: 'Næringslivets Roller',
      value: stats.total_roles,
      icon: UserCheck,
      color: 'text-amber-700',
      bgColor: 'bg-amber-50',
      onClick: () => focusSearch('person'),
      tooltip: 'Søk blant 6.4 millioner roller og personer'
    },
    {
      title: 'Geografisk Innsikt',
      value: ((stats.geocoded_count / stats.total_companies) * 100).toFixed(1) + '%',
      icon: MapPin,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      href: '/kart',
      tooltip: 'Se bedriftskartet og geografisk spredning'
    },
    {
      title: 'Verdiskaping',
      value: stats.total_ebitda,
      icon: TrendingUp,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
      isCurrency: true,
      href: '/bransjer',
      tooltip: 'Samlet EBITDA. Basert på siste tilgjengelige regnskapsår.'
    },
    {
      title: 'Næringslivets Puls',
      value: stats.new_companies_30d,
      icon: Zap,
      color: 'text-teal-600',
      bgColor: 'bg-teal-50',
      href: '/nyetableringer',
      tooltip: 'Nye selskaper stiftet de siste 30 dagene'
    },
    {
      title: 'Finansiell Robusthet',
      value: stats.solid_company_percentage.toFixed(1) + '%',
      icon: ShieldCheck,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
      href: '/bransjer',
      tooltip: 'Andel selskaper med over 20% egenkapitalandel (Siste regnskapsår)'
    },
  ]

  const handleCardClick = (card: StatCard) => {
    if (card.onClick) {
      card.onClick()
    } else if (card.href) {
      navigate({ to: card.href as unknown as Parameters<typeof navigate>[0]['to'] })
    }
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
      {cards.map((card, index) => (
        <button
          key={index}
          onClick={() => handleCardClick(card)}
          className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:shadow-xl hover:border-blue-300 hover:-translate-y-1 transition-all duration-300 flex flex-col items-center text-center cursor-pointer group relative overflow-hidden"
        >
          {/* Subtle background decoration */}
          <div className={`absolute -right-2 -top-2 w-12 h-12 ${card.bgColor} rounded-full opacity-10 group-hover:scale-150 group-hover:opacity-20 transition-all duration-500`}></div>

          <div className={`${card.bgColor} ${card.color} w-10 h-10 rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-sm`}>
            <card.icon className="h-5 w-5" />
          </div>

          <div className="text-sm text-gray-500 mb-1.5 font-bold flex items-center gap-1 group-hover:text-gray-900 transition-colors">
            {card.title}
          </div>

          <div className={`text-2xl font-black tabular-nums ${card.color} tracking-tight group-hover:scale-105 transition-transform`}>
            {typeof card.value === 'number'
              ? formatLargeNumber(card.value) + (card.isCurrency ? ' kr' : '')
              : card.value}
          </div>

          {/* Info icon to hint at tooltip/more info */}
          <div className="mt-2 text-[9px] text-gray-400 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Info size={10} />
            <span>{card.tooltip.split('.')[0]}</span>
          </div>
        </button>
      ))}
    </div>
  )
}
