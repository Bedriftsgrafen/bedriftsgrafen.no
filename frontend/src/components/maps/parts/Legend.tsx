import { getColor } from './mapUtils';

interface LegendProps {
    maxValue: number;
    metricLabel: string;
}

export function Legend({ maxValue, metricLabel }: LegendProps) {
    const steps = [0, 0.1, 0.2, 0.4, 0.6, 0.8, 1];

    return (
        <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-3 z-1000">
            <div className="text-xs font-medium text-gray-700 mb-2">{metricLabel}</div>
            <div className="flex gap-1">
                {steps.map((ratio, i) => (
                    <div key={i} className="flex flex-col items-center">
                        <div
                            className="w-5 h-4 border border-gray-200"
                            style={{ backgroundColor: getColor(ratio * maxValue, maxValue) }}
                        />
                        {i === 0 && <span className="text-[10px] text-gray-500 mt-1">0</span>}
                        {i === steps.length - 1 && (
                            <span className="text-[10px] text-gray-500 mt-1">
                                {maxValue >= 1000 ? `${Math.round(maxValue / 1000)}k` : parseFloat(maxValue.toFixed(1))}
                            </span>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
