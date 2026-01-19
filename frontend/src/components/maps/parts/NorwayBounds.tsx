import { useEffect } from 'react';
import { useMap } from 'react-leaflet';

export function NorwayBounds() {
    const map = useMap();

    useEffect(() => {
        map.fitBounds([
            [57.5, 4.5],   // Southwest
            [71.5, 31.5]   // Northeast
        ]);
    }, [map]);

    return null;
}
