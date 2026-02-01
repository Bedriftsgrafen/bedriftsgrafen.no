import { createFileRoute, redirect } from '@tanstack/react-router'

/**
 * Legacy route redirect: /bedrift/$orgnr -> /virksomhet/$orgnr
 * Ensures that old links and bookmarks continue to work while
 * promoting the new 'virksomhet' terminology.
 */
export const Route = createFileRoute('/bedrift/$orgnr')({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/virksomhet/$orgnr',
      params: { orgnr: params.orgnr },
      replace: true, // Replace in history to avoid back-button traps
    })
  },
  // No component needed as it always redirects
})