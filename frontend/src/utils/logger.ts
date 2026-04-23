/**
 * Dev-only logger.
 *
 * In production builds, all calls are no-ops so no internal details
 * leak to browser DevTools. In development they pass through to the
 * real console so debugging is unchanged.
 *
 * Usage:  import { logger } from '../utils/logger'
 *         logger.error('Something failed:', err)
 *
 * ESLint rule "no-console" is disabled only in this file so the rest
 * of the codebase must go through here.
 */

const isDev = import.meta.env.DEV

export const logger = {
  error: (msg: string, ...args: unknown[]): void => {
    if (isDev) console.error(msg, ...args) // eslint-disable-line no-console
  },
  warn: (msg: string, ...args: unknown[]): void => {
    if (isDev) console.warn(msg, ...args) // eslint-disable-line no-console
  },
}
