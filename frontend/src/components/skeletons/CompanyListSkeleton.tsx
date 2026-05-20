export function CompanyListSkeleton({ rows = 5, cols = 7 }: { rows?: number; cols?: number }) {
  // Width classes for skeleton columns to add variety
  const widths = ['w-48', 'w-24', 'w-16', 'w-32', 'w-16', 'w-20', 'w-20']

  return (
    <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className="animate-pulse">
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} className="px-5 py-3">
              <div className={`h-5 rounded bg-gray-200 dark:bg-slate-800 ${widths[j % widths.length]}`}></div>
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  )
}

