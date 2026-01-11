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
    <div className="bg-white rounded-xl shadow-md p-12 text-center">
      <div className="flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mx-auto mb-4">
        <Icon className="h-8 w-8 text-gray-400" />
      </div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600 mb-6 max-w-md mx-auto">{description}</p>
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
