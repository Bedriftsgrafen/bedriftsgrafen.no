import { formatNumber } from '../../../utils/formatters';
import type { GeoAverages, GeoLevel } from './types';

interface AveragesBoxProps {
    averages?: GeoAverages;
    level: GeoLevel;
    currentValue?: { name: string; value: number };
}

export function AveragesBox({ averages, level, currentValue }: AveragesBoxProps) {
    if (!averages) return null;

    const formatNum = (n: number) => formatNumber(n);

    return (
        <div className="absolute bottom-4 right-4 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-3 z-1000 min-w-[180px]">
            <div className="text-xs font-medium text-gray-700 mb-2">
                {level === 'county' ? 'Fylkessammenligning' : 'Kommunesammenligning'}
            </div>

            <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                    <span className="text-gray-600">Landssnitt:</span>
                    <span className="font-medium">{formatNumber(Math.round(averages.national_avg))}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-gray-600">Landstotal:</span>
                    <span className="font-medium">{formatNumber(averages.national_total)}</span>
                </div>

                {averages.county_avg !== undefined && (
                    <>
                        <hr className="my-1 border-gray-200" />
                        <div className="flex justify-between">
                            <span className="text-gray-600">{averages.county_name} snitt:</span>
                            <span className="font-medium">{formatNum(Math.round(averages.county_avg))}</span>
                        </div>
                    </>
                )}

                {currentValue && (
                    <>
                        <hr className="my-1 border-gray-200" />
                        <div className="flex justify-between text-blue-600">
                            <span className="font-medium">{currentValue.name}:</span>
                            <span className="font-bold">{formatNum(currentValue.value)}</span>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
