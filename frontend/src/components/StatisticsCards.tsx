import {
  Building2,
  FileText,
  Coins,
  PieChart,
  PlusCircle,
  AlertTriangle
} from 'lucide-react'
import type { ComponentType } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useStatsQuery } from '../hooks/queries/useStatsQuery'
import { useCompanyCountQuery } from '../hooks/queries/useCompanyCountQuery'
import { formatLargeNumber } from '../utils/formatters'
import { getOneYearAgo } from '../utils/dates'

interface StatCard {
  title: string
  value: number | string
  icon: ComponentType<{ className?: string }>
  color: string
  bgColor: string
  href?: string      // Navigate to page
  onClick?: () => void  // Or custom action
  tooltip: string
  isCurrency?: boolean
}

export function StatisticsCards() {
  const navigate = useNavigate()
  const { data: stats, isLoading: statsLoading } = useStatsQuery()

  // Calculate 12-month date for consistent queries
  const oneYearAgo = getOneYearAgo()

  // Use live counts for accuracy on critical metrics - matching route pages
  const { data: totalCount } = useCompanyCountQuery({})
  // 12-month queries to match /konkurser and /nyetableringer pages
  const { data: bankruptCount12m } = useCompanyCountQuery({
    is_bankrupt: true,
    bankrupt_from: oneYearAgo
  })
  const { data: newCompaniesCount12m } = useCompanyCountQuery({
    founded_from: oneYearAgo,
    organisasjonsform: ['AS'] // Match /nyetableringer filter
  })

  const isLoading = statsLoading

  // Scroll to company table on homepage
  const scrollToTable = () => {
    document.getElementById('company-table')?.scrollIntoView({ behavior: 'smooth' })
  }

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

  const cards: StatCard[] = [
    {
      title: 'Totalt bedrifter',
      value: totalCount ?? stats.total_companies,
      icon: Building2,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      onClick: scrollToTable,
      tooltip: 'Scroll til bedriftslisten'
    },
    {
      title: 'Regnskapsrapporter',
      value: stats.total_accounting_reports,
      icon: FileText,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      href: '/bransjer',
      tooltip: 'Se bransjestatistikk'
    },
    {
      title: 'Samlet omsetning',
      value: stats.total_revenue,
      icon: Coins,
      color: 'text-amber-700',
      bgColor: 'bg-amber-50',
      isCurrency: true,
      href: '/bransjer',
      tooltip: 'Se omsetning per bransje'
    },
    {
      title: 'Andel lønnsomme',
      value: stats.profitable_percentage.toFixed(1) + '%',
      icon: PieChart,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
      href: '/bransjer',
      tooltip: 'Se lønnsomhet per bransje'
    },
    {
      title: 'Nye siste år',
      value: newCompaniesCount12m ?? 0,
      icon: PlusCircle,
      color: 'text-teal-600',
      bgColor: 'bg-teal-50',
      href: '/nyetableringer',
      tooltip: 'Se nyetablerte selskaper'
    },
    {
      title: 'Konkurser siste år',
      value: bankruptCount12m ?? 0,
      icon: AlertTriangle,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      href: '/konkurser',
      tooltip: 'Se konkurser siste 12 mnd'
    },
  ]

  const handleCardClick = (card: StatCard) => {
    if (card.href) {
      navigate({ to: card.href })
    } else if (card.onClick) {
      card.onClick()
    }
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
      {cards.map((card, index) => (
        <button
          key={index}
          onClick={() => handleCardClick(card)}
          title={card.tooltip}
          aria-label={`${card.title}: ${typeof card.value === 'number' ? formatLargeNumber(card.value) + (card.isCurrency ? ' kr' : '') : card.value}. ${card.tooltip}`}
          className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 hover:shadow-md hover:border-blue-200 transition-all flex flex-col items-center text-center cursor-pointer group"
        >
          <div className={`${card.bgColor} ${card.color} w-10 h-10 rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
            <card.icon className="h-5 w-5" />
          </div>
          <div className="text-xs text-gray-500 mb-1 font-medium uppercase tracking-wide">{card.title}</div>
          <div className={`text-2xl font-bold tabular-nums ${card.color}`}>
            {typeof card.value === 'number'
              ? formatLargeNumber(card.value) + (card.isCurrency ? ' kr' : '')
              : card.value}
          </div>
        </button>
      ))}
    </div>
  )
}
