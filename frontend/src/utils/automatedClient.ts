const AUTOMATED_USER_AGENT_PATTERN =
  /(?:bot\b|crawler\b|spider\b|crawling\b|slurp\b|bingpreview\b|facebookexternalhit\b|google-inspectiontool\b|mediapartners-google\b|googleother\b|headlesschrome\b|lighthouse\b)/i

export function isAutomatedUserAgent(userAgent: string): boolean {
  return AUTOMATED_USER_AGENT_PATTERN.test(userAgent)
}

export function isAutomatedClient(): boolean {
  return typeof navigator !== 'undefined' && isAutomatedUserAgent(navigator.userAgent)
}
