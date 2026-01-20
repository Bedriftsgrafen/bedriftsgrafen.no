import React from 'react';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import L from 'leaflet';
import { Feature, Geometry, GeoJsonObject } from 'geojson';
import { NorwayBounds } from './parts/NorwayBounds';
import { MapAutoZoomer } from './parts/MapAutoZoomer';
import { CompanyMarkers } from './CompanyMarkers';
import { GeoLevel, GeoStat, RegionProperties } from './parts/types';

interface MapViewProps {
    level: GeoLevel;
    selectedNace?: string | null;
    metric: string;
    selectedCounty: string;
    geoData: GeoJsonObject;
    geoStats: GeoStat[] | undefined;
    selectedRegionCode: string | null;
    style: (feature: Feature<Geometry, RegionProperties> | undefined) => L.PathOptions;
    onEachFeature: (feature: Feature<Geometry, RegionProperties>, layer: L.Layer) => void;
    onCompanyClick?: (orgnr: string) => void;
    municipalityName?: string;
    municipalityCode?: string;
    organizationForms?: string[];
    revenueMin?: number | null;
    revenueMax?: number | null;
    profitMin?: number | null;
    profitMax?: number | null;
    equityMin?: number | null;
    equityMax?: number | null;
    operatingProfitMin?: number | null;
    operatingProfitMax?: number | null;
    liquidityRatioMin?: number | null;
    liquidityRatioMax?: number | null;
    equityRatioMin?: number | null;
    equityRatioMax?: number | null;
    employeeMin?: number | null;
    employeeMax?: number | null;
    foundedFrom?: string | null;
    foundedTo?: string | null;
    bankruptFrom?: string | null;
    bankruptTo?: string | null;
    isBankrupt?: boolean | null;
    inLiquidation?: boolean | null;
    inForcedLiquidation?: boolean | null;
    hasAccounting?: boolean | null;
    query?: string | null;
}

export const MapView: React.FC<MapViewProps> = ({
    level,
    selectedNace,
    metric,
    selectedCounty,
    geoData,
    geoStats,
    selectedRegionCode,
    style,
    onEachFeature,
    onCompanyClick,
    municipalityName,
    municipalityCode,
    organizationForms,
    revenueMin,
    revenueMax,
    profitMin,
    profitMax,
    equityMin,
    equityMax,
    operatingProfitMin,
    operatingProfitMax,
    liquidityRatioMin,
    liquidityRatioMax,
    equityRatioMin,
    equityRatioMax,
    employeeMin,
    employeeMax,
    foundedFrom,
    foundedTo,
    bankruptFrom,
    bankruptTo,
    isBankrupt,
    inLiquidation,
    inForcedLiquidation,
    hasAccounting,
    query
}) => {
    return (
        <MapContainer
            center={[65, 15]}
            zoom={4}
            scrollWheelZoom={true}
            style={{ height: '100%', width: '100%' }}
            className="bg-gray-50 outline-none"
        >
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
            />
            <NorwayBounds />
            <MapAutoZoomer selectedRegionCode={selectedRegionCode} geoData={geoData} />

            {geoStats && (
                <GeoJSON
                    key={`${level}-${selectedNace}-${metric}-${selectedCounty}-${selectedRegionCode || 'none'}`}
                    data={geoData}
                    style={style}
                    onEachFeature={onEachFeature}
                />
            )}

            <CompanyMarkers
                naceCode={selectedNace || null}
                countyCode={selectedCounty || (selectedRegionCode?.length === 2 ? selectedRegionCode : undefined)}
                municipalityName={municipalityName}
                municipalityCode={municipalityCode}
                onCompanyClick={onCompanyClick}
                organizationForms={organizationForms}
                revenueMin={revenueMin}
                revenueMax={revenueMax}
                profitMin={profitMin}
                profitMax={profitMax}
                equityMin={equityMin}
                equityMax={equityMax}
                operatingProfitMin={operatingProfitMin}
                operatingProfitMax={operatingProfitMax}
                liquidityRatioMin={liquidityRatioMin}
                liquidityRatioMax={liquidityRatioMax}
                equityRatioMin={equityRatioMin}
                equityRatioMax={equityRatioMax}
                employeeMin={employeeMin}
                employeeMax={employeeMax}
                foundedFrom={foundedFrom}
                foundedTo={foundedTo}
                bankruptFrom={bankruptFrom}
                bankruptTo={bankruptTo}
                isBankrupt={isBankrupt}
                inLiquidation={inLiquidation}
                inForcedLiquidation={inForcedLiquidation}
                hasAccounting={hasAccounting}
                query={query}
            />
        </MapContainer>
    );
};
