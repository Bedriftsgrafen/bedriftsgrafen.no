import React from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

interface HeroMapProps {
    lat: number;
    lng: number;
    zoom?: number;
    /**
     * 'dark' = CartoDB Dark Matter (for dark hero sections)
     * 'light' = CartoDB Positron (for light cards/backgrounds)
     */
    variant?: 'dark' | 'light';
}

/**
 * Helper component to recenter map when coordinates change.
 */
function MapRecenter({ lat, lng }: { lat: number; lng: number }) {
    const map = useMap();
    React.useEffect(() => {
        map.setView([lat, lng], map.getZoom());
    }, [map, lat, lng]);
    return null;
}

/**
 * A non-interactive background map designed for Hero sections and cards.
 * Supports both dark and light themes.
 * Memoized to prevent re-renders when used in large lists.
 */
export const HeroMap = React.memo<HeroMapProps>(({ lat, lng, zoom = 11, variant = 'dark' }) => {
    // Tile layer URLs
    const tileUrl = variant === 'dark'
        ? 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png'
        : 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png';

    return (
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
            <div className="absolute inset-0 filter grayscale brightness-110 contrast-75">
                <MapContainer
                    center={[lat, lng]}
                    zoom={zoom}
                    scrollWheelZoom={false}
                    zoomControl={false}
                    dragging={false}
                    touchZoom={false}
                    doubleClickZoom={false}
                    style={{ height: '100%', width: '100%' }}
                    className="pointer-events-auto"
                >
                    <TileLayer
                        url={tileUrl}
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    />
                    <MapRecenter lat={lat} lng={lng} />
                </MapContainer>
            </div>

            {/* Overlay for text readability - Premium subtle gradients */}
            {variant === 'dark' ? (
                <div className="absolute inset-0 bg-linear-to-b from-slate-900/80 via-slate-900/40 to-slate-900/90" />
            ) : (
                <div className="absolute inset-0 bg-linear-to-b from-white/60 via-white/20 to-white/80" />
            )}
        </div>
    );
});

HeroMap.displayName = 'HeroMap';
