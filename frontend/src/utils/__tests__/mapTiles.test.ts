import { describe, it, expect } from 'vitest'
import { getStaticMapUrl } from '../mapTiles'

describe('getStaticMapUrl', () => {
  it('returns deterministic CartoDB tile URL for given coordinates', () => {
    const url = getStaticMapUrl(59.9, 10.7, 11)
    expect(url).toBe('https://a.basemaps.cartocdn.com/light_nolabels/11/1084/595.png')
  })

  it('defaults to zoom 10', () => {
    const url = getStaticMapUrl(59.9, 10.7)
    expect(url).toContain('/10/')
  })
})
