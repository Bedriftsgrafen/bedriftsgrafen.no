import { getColor } from './mapUtils';
import clsx from 'clsx';

interface LegendProps {
    maxValue: number;
    metricLabel: string;
    isVertical?: boolean;
}

export function Legend({ maxValue, metricLabel, isVertical = false }: LegendProps) {
    const steps = [0, 0.1, 0.2, 0.4, 0.6, 0.8, 1];

    const containerClasses = isVertical
        ? "bg-white rounded-lg p-3 w-full border border-slate-100"
        : "absolute bottom-4 left-4 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-3 z-1000";

    return (
        <div className={containerClasses}>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">{metricLabel}</div>
            <div className={clsx("flex gap-1", isVertical ? "justify-between" : "")}>
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
