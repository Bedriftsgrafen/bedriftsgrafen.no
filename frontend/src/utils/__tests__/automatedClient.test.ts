import { describe, expect, it } from 'vitest'
import { isAutomatedUserAgent } from '../automatedClient'

describe('isAutomatedUserAgent', () => {
  it.each([
    'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 Chrome/151.0.0.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; Google-InspectionTool/1.0)',
    'Mozilla/5.0 AppleWebKit/537.36 HeadlessChrome/151.0.0.0 Safari/537.36',
  ])('recognizes automated user agents', (userAgent) => {
    expect(isAutomatedUserAgent(userAgent)).toBe(true)
  })

  it('does not classify a normal browser as automated', () => {
    const userAgent =
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36'

    expect(isAutomatedUserAgent(userAgent)).toBe(false)
  })
})
