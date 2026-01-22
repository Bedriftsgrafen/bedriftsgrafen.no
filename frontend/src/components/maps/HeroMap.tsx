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
 */
export const HeroMap: React.FC<HeroMapProps> = ({ lat, lng, zoom = 11, variant = 'dark' }) => {
    // Tile layer URLs
    const tileUrl = variant === 'dark'
        ? 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png'
        : 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png';

    return (
        <div className="absolute inset-0 z-0 pointer-events-none">
            <MapContainer
                center={[lat, lng]}
                zoom={zoom}
                scrollWheelZoom={false}
                zoomControl={false}
                dragging={false}
                touchZoom={false}
                doubleClickZoom={false}
                style={{ height: '100%', width: '100%' }}
            >
                <TileLayer
                    url={tileUrl}
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                />
                <MapRecenter lat={lat} lng={lng} />
            </MapContainer>

            {/* Overlay for text readability */}
            {variant === 'dark' && (
                <div className="absolute inset-0 bg-slate-900/40" />
            )}
        </div>
    );
};
