import { createFileRoute } from '@tanstack/react-router'

// The route handles slugified codes like "46-vestland"
export const Route = createFileRoute('/fylke/$code')({})

