import { logger } from './logger'

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch (err) {
    logger.error('Failed to copy:', err)
    return false
  }
}
