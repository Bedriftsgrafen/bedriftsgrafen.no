/**
 * Generate a static map tile URL for a municipality card background.
 * Uses CartoDB Positron (light) tiles for a premium, subtle look.
 */
export function getStaticMapUrl(lat: number, lng: number, zoom: number = 10): string {
  const tiles = Math.pow(2, zoom)
  const x = Math.floor(((lng + 180) / 360) * tiles)
  const y = Math.floor(
    ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) *
      tiles,
  )
  return `https://a.basemaps.cartocdn.com/light_nolabels/${zoom}/${x}/${y}.png`
}
