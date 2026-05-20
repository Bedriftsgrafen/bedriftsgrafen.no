import { LucideIcon } from 'lucide-react'
import { Button } from './common/Button'

interface Props {
  icon: LucideIcon
  title: string
  description: string
  action?: {
    label: string
    onClick: () => void
  }
}

export function EmptyState({ icon: Icon, title, description, action }: Props) {
  return (
    <div className="rounded-xl bg-white p-6 text-center shadow-md dark:border dark:border-slate-800 dark:bg-slate-900 md:p-12">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-slate-800">
        <Icon className="h-8 w-8 text-gray-400 dark:text-slate-500" />
      </div>
      <h3 className="mb-2 text-xl font-semibold text-gray-900 dark:text-white">{title}</h3>
      <p className="mx-auto mb-6 max-w-md text-gray-600 dark:text-slate-400">{description}</p>
      {action && (
        <Button
          onClick={action.onClick}
          variant="primary"
          size="lg"
        >
          {action.label}
        </Button>
      )}
    </div>
  )
}
