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
    <nav 
      aria-label="Breadcrumb" 
      className={isDefault ? 'mb-6 px-4 py-3' : 'mb-6'}
      itemScope 
      itemType="https://schema.org/BreadcrumbList"
    >
      <ol className="flex items-center gap-1 text-sm font-medium">
        {items.map((item, index) => (
          <li 
            key={`${item.to || 'current'}-${index}-${item.label}`} 
            className="flex items-center gap-1"
            itemProp="itemListElement" 
            itemScope 
            itemType="https://schema.org/ListItem"
          >
            {index > 0 && (
              <ChevronRight
                className={`h-4 w-4 shrink-0 ${isDefault ? 'text-gray-400' : 'text-white/20'}`}
                aria-hidden="true"
              />
            )}
            
            <meta itemProp="position" content={(index + 1).toString()} />
            
            {item.to ? (
              <Link
                to={item.to}
                itemProp="item"
                className={item.className || (isDefault ? 'text-blue-600 hover:text-blue-700' : 'text-white/60 hover:text-white')}
              >
                <span itemProp="name">{item.label}</span>
              </Link>
            ) : (
              <span
                itemProp="name"
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
