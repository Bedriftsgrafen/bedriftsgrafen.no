import { useMemo, useState, useEffect, startTransition } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import { ExternalLink, MapPin } from 'lucide-react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
    getCoordinatesForPostalCodeAsync,
    getGoogleMapsAddressUrl,
    type Coordinates,
} from '../../utils/postalCoordinates'

// Fix Leaflet default marker icon issue
import icon from 'leaflet/dist/images/marker-icon.png'
import iconShadow from 'leaflet/dist/images/marker-shadow.png'

const DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
})

L.Marker.prototype.options.icon = DefaultIcon

/** Props for LocationMap */
interface LocationMapProps {
    /** Company name for popup */
    companyName: string
    /** Full address for Google Maps link */
    address: string
    /** Postal code for coordinate lookup (fallback) */
    postalCode?: string
    /** Optional height (default: 200px) */
    height?: number
    /** Backend-geocoded latitude (takes priority over postal lookup) */
    latitude?: number | null
    /** Backend-geocoded longitude (takes priority over postal lookup) */
    longitude?: number | null
    /** Timestamp for last geocoding */
    geocodedAt?: string | null
}

/**
 * Helper component to recenter map when coordinates change.
 * MapContainer center prop only works on initial render.
 */
function MapRecenter({ coords }: { coords: Coordinates }) {
    const map = useMap()

    useEffect(() => {
        map.setView(coords, map.getZoom())
    }, [map, coords])

    return null
}

/**
 * Simple map showing company location.
 * Uses backend coordinates if available, falls back to postal code lookup.
 * Click marker popup to open in Google Maps.
 */
export function LocationMap({
    companyName,
    address,
    postalCode,
    height = 200,
    latitude,
    longitude,
    geocodedAt,
}: LocationMapProps) {
    // State for async-loaded postal coordinates
    const [postalCoords, setPostalCoords] = useState<Coordinates | null>(null)
    const [loadingPostal, setLoadingPostal] = useState(false)

    // Compute stable key from props to trigger re-fetch
    const propsKey = `${latitude}-${longitude}-${postalCode}`

    // Determine if we have backend coords
    const hasBackendCoords = latitude != null && longitude != null

    // Fetch postal coords only when needed
    useEffect(() => {
        // Skip if we have backend coords
        if (hasBackendCoords) {
            return
        }

        // Reset and fetch
        let cancelled = false

        // Use ref to avoid calling setState for loading in effect body
        const fetchCoords = async () => {
            const coords = await getCoordinatesForPostalCodeAsync(postalCode)
            if (!cancelled) {
                startTransition(() => {
                    setPostalCoords(coords)
                    setLoadingPostal(false)
                })
            }
        }

        // Set loading before fetch (outside async)
        startTransition(() => setLoadingPostal(true))
        fetchCoords()

        return () => { cancelled = true }
    }, [propsKey, hasBackendCoords, postalCode])

    // Compute final coordinates
    const coordinates: Coordinates | null = useMemo(() => {
        if (hasBackendCoords) {
            return [latitude!, longitude!]
        }
        return postalCoords
    }, [hasBackendCoords, latitude, longitude, postalCoords])

    const loading = !hasBackendCoords && loadingPostal

    const googleMapsUrl = useMemo(
        () => getGoogleMapsAddressUrl(address),
        [address]
    )

    // Show loading state
    if (loading || coordinates === null) {
        return (
            <div
                className="rounded-lg overflow-hidden border border-gray-200 bg-gray-100 flex items-center justify-center"
                style={{ height: `${height}px` }}
            >
                <div className="text-gray-400 flex items-center gap-2">
                    <MapPin className="h-5 w-5 animate-pulse" />
                    <span className="text-sm">Laster kart...</span>
                </div>
            </div>
        )
    }

    return (
        <div className="rounded-lg overflow-hidden border border-gray-200">
            <MapContainer
                center={coordinates}
                zoom={14}
                scrollWheelZoom={false}
                style={{ height: `${height}px`, width: '100%' }}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {/* Recenter map when coordinates change */}
                <MapRecenter coords={coordinates} />
                <Marker position={coordinates}>
                    <Popup>
                        <div className="text-sm">
                            <p className="font-medium mb-1">{companyName}</p>
                            <p className="text-gray-600 text-xs mb-1">{address}</p>
                            {geocodedAt && (
                                <p className="text-gray-400 text-[10px] mb-2 italic">
                                    Kartdata: {new Date(geocodedAt).toLocaleDateString('nb-NO')}
                                </p>
                            )}
                            <a
                                href={googleMapsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs font-medium"
                            >
                                <ExternalLink className="h-3 w-3" />
                                Åpne i Google Maps
                            </a>
                        </div>
                    </Popup>
                </Marker>
            </MapContainer>
        </div>
    )
}
