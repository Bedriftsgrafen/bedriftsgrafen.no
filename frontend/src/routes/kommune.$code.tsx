import { createFileRoute } from '@tanstack/react-router'

// The route handles slugified codes like "0301-oslo"
export const Route = createFileRoute('/kommune/$code')({})
