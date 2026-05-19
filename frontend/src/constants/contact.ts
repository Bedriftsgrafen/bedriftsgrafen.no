export const CONTACT_EMAIL = 'bedriftsgrafen@gmail.com'

export const DEFAULT_CONTACT_SUBJECT = 'Spørsmål om Bedriftsgrafen.no'

export function getContactEmailHref(subject = DEFAULT_CONTACT_SUBJECT) {
	return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}`
}

export function isBedriftsgrafenContactHref(href: string) {
	const contactHref = `mailto:${CONTACT_EMAIL.toLowerCase()}`
	const normalizedHref = href.trim().toLowerCase()

	return normalizedHref === contactHref || normalizedHref.startsWith(`${contactHref}?`)
}
