/**
 * Get color based on value and max value for choropleth scale.
 */
export const getColor = (value: number, max: number): string => {
    if (max === 0) return '#f7fafc';
    const ratio = value / max;

    // Blue color scale (light to dark)
    if (ratio > 0.8) return '#1e40af';
    if (ratio > 0.6) return '#2563eb';
    if (ratio > 0.4) return '#3b82f6';
    if (ratio > 0.2) return '#60a5fa';
    if (ratio > 0.1) return '#93c5fd';
    if (ratio > 0) return '#bfdbfe';
    return '#f7fafc';
};
