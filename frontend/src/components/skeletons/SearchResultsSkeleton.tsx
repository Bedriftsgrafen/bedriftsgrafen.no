export function SearchResultsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="absolute z-10 w-full mt-2 bg-white rounded-lg shadow-lg border border-gray-200">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="p-4 border-b border-gray-100 last:border-0 animate-pulse">
          <div className="h-5 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      ))}
    </div>
  )
}
