import { Link } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'

export interface BreadcrumbItem {
  label: string
  to?: string
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[]
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className="mb-6">
      <ol className="flex items-center gap-1 text-sm">
        {items.map((item, index) => (
          <li key={`${item.to || 'current'}-${item.label}`} className="flex items-center gap-1">
            {index > 0 && (
              <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" aria-hidden="true" />
            )}
            {item.to ? (
              <Link
                to={item.to}
                className="text-blue-600 hover:text-blue-700 hover:underline transition-colors"
              >
                {item.label}
              </Link>
            ) : (
              <span className="text-gray-600" aria-current="page">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
