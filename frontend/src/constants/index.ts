export * from './organizationForms'
export * from './seo'
export * from './explorer'

// Validation patterns
export const ORGNR_PATTERN = /^\d{9}$/
export const isValidOrgnr = (value: string): boolean => ORGNR_PATTERN.test(value.trim())
