interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  color?: 'blue' | 'gray'
}

export function Spinner({ size = 'md', color = 'blue' }: SpinnerProps) {
  const sizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-6 h-6'
  }

  const colorClasses = {
    blue: 'border-blue-600',
    gray: 'border-gray-400'
  }

  return (
    <span
      className={`inline-block ${sizeClasses[size]} border-2 ${colorClasses[color]} border-t-transparent rounded-full animate-spin`}
      role="status"
      aria-label="Laster..."
    />
  )
}
