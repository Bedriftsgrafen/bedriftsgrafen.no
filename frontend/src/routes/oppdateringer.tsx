/* eslint-disable react-refresh/only-export-components */
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { OppdateringerPage, type OppdateringerTabId } from '../components/updates/OppdateringerPage'

export const Route = createFileRoute('/oppdateringer')({
  validateSearch: (search) => z.object({
    tab: z.enum(['oversikt', 'nyetableringer', 'konkurser', 'regnskap', 'datastatus']).optional().catch('oversikt'),
  }).parse(search),
  component: OppdateringerRouteComponent,
})

function OppdateringerRouteComponent() {
  const { tab = 'oversikt' } = Route.useSearch() as { tab?: OppdateringerTabId }

  return <OppdateringerPage activeTab={tab ?? 'oversikt'} />
}
