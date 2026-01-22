import { Link } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'

export interface BreadcrumbItem {
  label: string
  to?: string
  className?: string
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[]
  variant?: 'default' | 'transparent'
}

export function Breadcrumbs({ items, variant = 'default' }: BreadcrumbsProps) {
  const isDefault = variant === 'default'

  return (
    <nav aria-label="Breadcrumb" className={isDefault ? 'mb-6 px-4 py-3' : 'mb-6'}>
      <ol className="flex items-center gap-1 text-sm font-medium">
        {items.map((item, index) => (
          <li key={`${item.to || 'current'}-${index}-${item.label}`} className="flex items-center gap-1">
            {index > 0 && (
              <ChevronRight
                className={`h-4 w-4 shrink-0 ${isDefault ? 'text-gray-400' : 'text-white/20'}`}
                aria-hidden="true"
              />
            )}
            {item.to ? (
              <Link
                to={item.to}
                className={item.className || (isDefault ? 'text-blue-600 hover:text-blue-700' : 'text-white/60 hover:text-white')}
              >
                {item.label}
              </Link>
            ) : (
              <span
                className={item.className || (isDefault ? 'text-gray-600' : 'text-white')}
                aria-current="page"
              >
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
