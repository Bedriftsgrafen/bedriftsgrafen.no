export const CONTACT_EMAIL = 'bedriftsgrafen@gmail.com'

export const DEFAULT_CONTACT_SUBJECT = 'Spørsmål om Bedriftsgrafen.no'

const GMAIL_COMPOSE_URL = 'https://mail.google.com/mail/'
const GMAIL_COMPOSE_QUERY = 'view=cm&fs=1&tf=1'

export function getContactEmailHref(subject = DEFAULT_CONTACT_SUBJECT) {
	return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}`
}

export function getContactGmailComposeHref(subject?: string) {
	const baseHref = `${GMAIL_COMPOSE_URL}?${GMAIL_COMPOSE_QUERY}&to=${CONTACT_EMAIL}`

	if (subject?.trim()) {
		return `${baseHref}&su=${encodeURIComponent(subject.trim())}`
	}

	return baseHref
}

export function isBedriftsgrafenContactHref(href: string) {
	const contactHref = `mailto:${CONTACT_EMAIL.toLowerCase()}`
	const normalizedHref = href.trim().toLowerCase()

	return normalizedHref === contactHref || normalizedHref.startsWith(`${contactHref}?`)
}
