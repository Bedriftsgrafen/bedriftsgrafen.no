import { Naeringskode } from '../types'

/**
 * Gets the NACE code string from a value that could be a string or a Naeringskode object.
 */
export function getNaceCode(value: string | Naeringskode | null | undefined): string {
  if (!value) return ''
  if (typeof value === 'string') return value
  return value.kode
}

/**
 * Gets the NACE description string from a value that could be a string or a Naeringskode object.
 */
export function getNaceDescription(value: string | Naeringskode | null | undefined): string {
  if (!value) return ''
  if (typeof value === 'string') return ''
  return value.beskrivelse
}

/**
 * Formats a NACE code and its description for display (e.g., "62.010 - Programmeringstjenester").
 * Falls back to just the code if description is missing.
 */
export function formatNace(value: string | Naeringskode | null | undefined): string {
  if (!value) return ''
  if (typeof value === 'string') return value

  if (value.beskrivelse) {
    return `${value.kode} - ${value.beskrivelse}`
  }

  return value.kode
}

/**
 * Splits a NACE code into its hierarchical parts.
 */
export function getNaceLevel(code: string | Naeringskode | null | undefined): string[] {
  const codeStr = getNaceCode(code)
  if (!codeStr) return []
  return codeStr.split('.')
}