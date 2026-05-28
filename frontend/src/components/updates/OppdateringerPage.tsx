import { Link } from '@tanstack/react-router'
import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  ArrowRight,
  Building2,
  CalendarClock,
  CheckCircle2,
  Database,
  FileClock,
  Info,
  RefreshCw,
  ShieldAlert,
  UsersRound,
} from 'lucide-react'
import { SEOHead } from '../layout'
import { ErrorState, LoadingState } from '../common'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import {
  ActivityCompanyItem,
  ActivityFeed,
  ActivityOverview,
  useActivityOverviewQuery,
} from '../../hooks/queries/useActivityOverviewQuery'
import { formatDate, formatNumber } from '../../utils/formatters'
import { formatNace } from '../../utils/nace'

const dateTimeFormatter = new Intl.DateTimeFormat('nb-NO', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

function formatDateTime(value: string | null | undefined) {
  if (!value) return '-'
  try {
    return dateTimeFormatter.format(new Date(value))
  } catch {
    return '-'
  }
}

export type OppdateringerTabId = 'oversikt' | 'nyetableringer' | 'konkurser' | 'endringer' | 'regnskap' | 'ansatte' | 'datastatus'

const tabs: { id: OppdateringerTabId; label: string; icon: LucideIcon }[] = [
  { id: 'oversikt', label: 'Oversikt', icon: Activity },
  { id: 'nyetableringer', label: 'Nyetableringer', icon: Building2 },
  { id: 'konkurser', label: 'Konkurser', icon: ShieldAlert },
  { id: 'endringer', label: 'Endringer', icon: RefreshCw },
  { id: 'regnskap', label: 'Regnskap', icon: FileClock },
  { id: 'ansatte', label: 'Ansatte', icon: UsersRound },
  { id: 'datastatus', label: 'Datastatus', icon: Database },
]

const fallbackBusinessChangesFeed: ActivityFeed = {
  id: 'business_changes',
  title: 'Virksomhetsendringer',
  description: 'Navn, adresse, næringskode og statusendringer vises her etter at eventloggen har registrert dem.',
  source: 'Brreg oppdateringsstrøm via Bedriftsgrafen eventlogg',
  time_label: 'Brreg-oppdatering',
  items: [],
}

function getBusinessChangesFeed(data: ActivityOverview) {
  return data.business_changes ?? fallbackBusinessChangesFeed
}

export function OppdateringerPage({ activeTab = 'oversikt' }: { activeTab?: OppdateringerTabId }) {
  const { data, isLoading, error } = useActivityOverviewQuery(12)
  useDocumentTitle('Oppdateringer | Bedriftsgrafen.no')

  return (
    <>
      <SEOHead
        title="Oppdateringer | Bedriftsgrafen.no"
        description="Siste registreringer, konkurser og datastatus fra Bedriftsgrafen.no."
        noindex
      />

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-blue-800 dark:border-blue-400/20 dark:bg-blue-500/15 dark:text-blue-200">
                <CalendarClock aria-hidden="true" className="h-3.5 w-3.5" />
                Oppdatert datagrunnlag
              </div>
              <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-950 dark:text-white md:text-4xl">
                Siste oppdateringer
              </h1>
              <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600 dark:text-slate-300 sm:text-lg">
                Nye virksomheter, konkurser og datastatus samlet med tydelige kilder og datoer.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
              <span className="font-semibold text-slate-900 dark:text-white">Sist hentet:</span>{' '}
              {data ? formatDateTime(data.generated_at) : '-'}
            </div>
          </div>
        </header>

        <nav aria-label="Oppdateringsvisning" className="mb-6 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex min-w-max gap-1">
            {tabs.map((item) => {
              const Icon = item.icon
              const selected = activeTab === item.id

              return (
                <Link
                  key={item.id}
                  to="/oppdateringer"
                  search={{ tab: item.id }}
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-blue-300 dark:focus-visible:ring-offset-slate-900 ${selected
                    ? 'bg-blue-900 text-white shadow-sm dark:bg-blue-500 dark:text-slate-950'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white'
                    }`}
                >
                  <Icon aria-hidden="true" className="h-4 w-4" />
                  {item.label}
                </Link>
              )
            })}
          </div>
        </nav>

        {isLoading && <LoadingState message="Laster oppdateringer..." />}
        {error && <ErrorState message="Kunne ikke laste oppdateringer akkurat nå" />}
        {data && <ActivityContent data={data} activeTab={activeTab} />}
      </div>
    </>
  )
}

function ActivityContent({ data, activeTab }: { data: ActivityOverview; activeTab: OppdateringerTabId }) {
  const showOverview = activeTab === 'oversikt'
  const businessChangesFeed = getBusinessChangesFeed(data)

  return (
    <div className="space-y-6">
      {showOverview && <ActivitySummary data={data} />}

      {(showOverview || activeTab === 'nyetableringer') && (
        <ActivityFeedSection
          feed={data.new_companies}
          icon={Building2}
          color="green"
          fullLink="/nyetableringer"
          fullLinkLabel="Se hele nyetableringslisten"
        />
      )}

      {(showOverview || activeTab === 'konkurser') && (
        <ActivityFeedSection
          feed={data.bankruptcies}
          icon={ShieldAlert}
          color="red"
          fullLink="/konkurser"
          fullLinkLabel="Se hele konkurslisten"
        />
      )}

      {(showOverview || activeTab === 'endringer') && (
        <ActivityFeedSection
          feed={businessChangesFeed}
          icon={RefreshCw}
          color="teal"
        />
      )}

      {(showOverview || activeTab === 'regnskap') && (
        <ActivityFeedSection
          feed={data.accounting_updates}
          icon={FileClock}
          color="blue"
        />
      )}

      {(showOverview || activeTab === 'ansatte') && (
        <ActivityFeedSection
          feed={data.employee_changes}
          icon={UsersRound}
          color="amber"
        />
      )}

      {(showOverview || activeTab === 'datastatus') && <DataStatusPanel data={data} />}
    </div>
  )
}

function ActivitySummary({ data }: { data: ActivityOverview }) {
  const businessChangesFeed = getBusinessChangesFeed(data)
  const summaryItems = [
    {
      label: 'Nye virksomheter',
      value: formatNumber(data.new_companies.items.length),
      helper: 'Nyeste kildedatoer',
      icon: Building2,
      color: 'bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-200 dark:ring-emerald-400/20',
    },
    {
      label: 'Konkurser',
      value: formatNumber(data.bankruptcies.items.length),
      helper: 'Nyeste konkursdatoer',
      icon: ShieldAlert,
      color: 'bg-red-50 text-red-700 ring-red-100 dark:bg-red-500/15 dark:text-red-200 dark:ring-red-400/20',
    },
    {
      label: 'Endringer',
      value: formatNumber(businessChangesFeed.items.length),
      helper: 'Fra Brreg-oppdateringer',
      icon: RefreshCw,
      color: 'bg-teal-50 text-teal-700 ring-teal-100 dark:bg-teal-500/15 dark:text-teal-200 dark:ring-teal-400/20',
    },
    {
      label: 'Regnskap',
      value: formatNumber(data.accounting_updates.items.length),
      helper: 'Eventlogg-støttet feed',
      icon: FileClock,
      color: 'bg-sky-50 text-sky-700 ring-sky-100 dark:bg-sky-500/15 dark:text-sky-200 dark:ring-sky-400/20',
    },
    {
      label: 'Ansatte',
      value: formatNumber(data.employee_changes.items.length),
      helper: 'Eventlogg fra Brreg',
      icon: UsersRound,
      color: 'bg-amber-50 text-amber-800 ring-amber-100 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-400/20',
    },
    {
      label: 'Datakilder',
      value: formatNumber(data.data_status.length),
      helper: 'Synkroniserte statuser',
      icon: Database,
      color: 'bg-blue-50 text-blue-700 ring-blue-100 dark:bg-blue-500/15 dark:text-blue-200 dark:ring-blue-400/20',
    },
    {
      label: 'Utsatte feeds',
      value: formatNumber(data.deferred_feeds.length),
      helper: 'Venter på datakilde',
      icon: FileClock,
      color: 'bg-amber-50 text-amber-800 ring-amber-100 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-400/20',
    },
  ]

  return (
    <section aria-label="Oppsummering" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {summaryItems.map((item) => {
        const Icon = item.icon
        return (
          <div key={item.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{item.label}</p>
                <p className="mt-2 text-3xl font-bold tabular-nums text-slate-950 dark:text-white">{item.value}</p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{item.helper}</p>
              </div>
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ${item.color}`}>
                <Icon aria-hidden="true" className="h-5 w-5" />
              </span>
            </div>
          </div>
        )
      })}
    </section>
  )
}

function ActivityFeedSection({
  feed,
  icon: Icon,
  color,
  fullLink,
  fullLinkLabel,
}: {
  feed: ActivityFeed
  icon: LucideIcon
  color: 'green' | 'red' | 'blue' | 'amber' | 'teal'
  fullLink?: '/nyetableringer' | '/konkurser'
  fullLinkLabel?: string
}) {
  const accent = {
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-200 dark:ring-emerald-400/20',
    red: 'bg-red-50 text-red-700 ring-red-100 dark:bg-red-500/15 dark:text-red-200 dark:ring-red-400/20',
    teal: 'bg-teal-50 text-teal-700 ring-teal-100 dark:bg-teal-500/15 dark:text-teal-200 dark:ring-teal-400/20',
    blue: 'bg-sky-50 text-sky-700 ring-sky-100 dark:bg-sky-500/15 dark:text-sky-200 dark:ring-sky-400/20',
    amber: 'bg-amber-50 text-amber-800 ring-amber-100 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-400/20',
  }[color]

  return (
    <section aria-labelledby={`${feed.id}-title`} className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-4 border-b border-slate-200 p-5 dark:border-slate-800 sm:flex-row sm:items-start sm:justify-between sm:p-6">
        <div className="flex gap-3">
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ${accent}`}>
            <Icon aria-hidden="true" className="h-5 w-5" />
          </span>
          <div>
            <h2 id={`${feed.id}-title`} className="text-xl font-bold tracking-tight text-slate-950 dark:text-white">
              {feed.title}
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{feed.description}</p>
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-500">
              {feed.time_label} · {feed.source}
            </p>
          </div>
        </div>
        {fullLink && fullLinkLabel && (
          <Link
            to={fullLink}
            className="inline-flex items-center gap-2 self-start rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-slate-700 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white dark:focus-visible:ring-blue-300 dark:focus-visible:ring-offset-slate-900"
          >
            {fullLinkLabel}
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Link>
        )}
      </div>

      <div className="divide-y divide-slate-200 dark:divide-slate-800">
        {feed.items.length === 0 && (
          <div className="p-4 text-sm text-slate-600 dark:text-slate-400 sm:p-5">
            Ingen hendelser i denne feeden ennå.
          </div>
        )}
        {feed.items.map((item, index) => (
          <ActivityRow key={`${feed.id}-${item.orgnr}-${item.event_date ?? index}-${index}`} item={item} />
        ))}
      </div>
    </section>
  )
}

function ActivityRow({ item }: { item: ActivityCompanyItem }) {
  const nace = formatNace(item.naeringskode)

  return (
    <Link
      to="/virksomhet/$orgnr"
      params={{ orgnr: item.orgnr }}
      className="group block p-4 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 dark:hover:bg-white/5 sm:p-5"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="min-w-0 wrap-break-word text-base font-semibold text-slate-950 group-hover:text-blue-800 dark:text-white dark:group-hover:text-blue-200">
              {item.navn || item.orgnr}
            </h3>
            {item.organisasjonsform && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {item.organisasjonsform}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {item.orgnr} · {item.event_label}
          </p>
          {nace && <p className="mt-1 wrap-break-word text-sm text-slate-600 dark:text-slate-400">{nace}</p>}
        </div>

        <dl className="grid shrink-0 grid-cols-2 gap-3 text-sm sm:min-w-64">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-500">Dato</dt>
            <dd className="mt-1 font-semibold tabular-nums text-slate-900 dark:text-white">{formatDate(item.event_date)}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-500">Ansatte</dt>
            <dd className="mt-1 font-semibold tabular-nums text-slate-900 dark:text-white">
              {item.antall_ansatte != null ? formatNumber(item.antall_ansatte) : '-'}
            </dd>
          </div>
        </dl>
      </div>
    </Link>
  )
}

function DataStatusPanel({ data }: { data: ActivityOverview }) {
  return (
    <section aria-labelledby="data-status-title" className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.55fr)]">
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 p-5 dark:border-slate-800 sm:p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 ring-1 ring-blue-100 dark:bg-blue-500/15 dark:text-blue-200 dark:ring-blue-400/20">
              <RefreshCw aria-hidden="true" className="h-5 w-5" />
            </span>
            <div>
              <h2 id="data-status-title" className="text-xl font-bold tracking-tight text-slate-950 dark:text-white">
                Datastatus
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                Synkroniseringer Bedriftsgrafen har registrert fra kildene sine.
              </p>
            </div>
          </div>
        </div>

        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {data.data_status.map((item) => (
            <div key={item.key} className="p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="font-semibold text-slate-950 dark:text-white">{item.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{item.description}</p>
                  <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-500">{item.source}</p>
                </div>
                <div className="shrink-0 rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-950">
                  <span className="block font-semibold text-slate-950 dark:text-white">{item.value || 'Oppdatert'}</span>
                  <span className="mt-1 block tabular-nums text-slate-600 dark:text-slate-400">{formatDateTime(item.updated_at)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {data.deferred_feeds.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-slate-800 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 ring-1 ring-blue-100 dark:bg-blue-500/15 dark:text-blue-200 dark:ring-blue-400/20">
            <Info aria-hidden="true" className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-slate-950 dark:text-white">Planlagt datakilde</h2>
            {data.deferred_feeds.map((feed) => (
              <div key={feed.id} className="mt-3 text-sm leading-6">
                <p className="font-semibold">{feed.title}</p>
                <p className="mt-1 text-slate-600 dark:text-slate-300">{feed.reason}</p>
                <p className="mt-1 text-slate-600 dark:text-slate-300">{feed.requirement}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 xl:col-span-2 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700">
            <Info aria-hidden="true" className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-semibold text-slate-950 dark:text-white">Tidsstempler</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
              Registreringsdato og konkursdato kommer fra Brreg-kildene. Regnskaps- og ansattfeedene viser når Bedriftsgrafen observerte eller importerte hendelsen.
            </p>
            <p className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-200">
              <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
              Regnskaps- og ansattfeedene er eventlogg-støttet og bruker ikke skanning av store datatabeller ved lasting av siden.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
