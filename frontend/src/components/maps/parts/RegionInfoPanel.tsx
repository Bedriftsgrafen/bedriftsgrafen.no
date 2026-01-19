import { ExternalLink } from 'lucide-react';
import { formatNumber } from '../../../utils/formatters';

interface RegionInfoPanelProps {
    regionData: {
        name: string;
        code: string;
        value: number;
        perCapita?: number;
        population?: number;
    };
    showPerCapita: boolean;
    metricLabel: string;
    onClose: () => void;
    onShowCompanies: (name: string, code: string) => void;
}

export function RegionInfoPanel({
    regionData,
    showPerCapita,
    metricLabel,
    onClose,
    onShowCompanies,
}: RegionInfoPanelProps) {
    return (
        <div className="absolute top-14 right-4 z-1000 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-3 min-w-[200px]">
            <div className="flex justify-between items-start mb-2">
                <div>
                    <div className="text-sm font-medium text-gray-900">{regionData.name}</div>
                    <div className="text-lg font-bold text-blue-600">
                        {showPerCapita && regionData.perCapita != null
                            ? regionData.perCapita.toFixed(1)
                            : formatNumber(regionData.value)}
                        <span className="text-xs font-normal text-gray-500 ml-1">
                            {showPerCapita ? `per 1000 innb.` : metricLabel.toLowerCase()}
                        </span>
                    </div>
                    {regionData.population && (
                        <div className="text-xs text-gray-500 mt-1">
                            Befolkning: {formatNumber(regionData.population)}
                        </div>
                    )}
                </div>
                <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-600 text-lg leading-none"
                    aria-label="Lukk panel"
                >
                    ×
                </button>
            </div>
            <button
                onClick={() => onShowCompanies(regionData.name, regionData.code)}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
            >
                <ExternalLink className="h-4 w-4" />
                Vis bedrifter
            </button>
        </div>
    );
}
