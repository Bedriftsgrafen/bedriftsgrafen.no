import React from 'react';

interface StatusControlsProps {
    isBankrupt: boolean | null;
    setIsBankrupt: (val: boolean | null) => void;
    hasAccounting: boolean | null;
    setHasAccounting: (val: boolean | null) => void;
    inLiquidation: boolean | null;
    setInLiquidation: (val: boolean | null) => void;
}

export const StatusControls: React.FC<StatusControlsProps> = ({
    isBankrupt,
    setIsBankrupt,
    hasAccounting,
    setHasAccounting,
    inLiquidation,
    setInLiquidation,
}) => {
    return (
        <section className="space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Selskapsstatus</h3>

            <div className="flex flex-wrap gap-2">
                <button
                    onClick={() => setIsBankrupt(isBankrupt === true ? null : true)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${isBankrupt === true
                        ? 'bg-red-100 text-red-700 border-red-200 shadow-sm'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                        }`}
                >
                    Konkurs
                </button>
                <button
                    onClick={() => setHasAccounting(hasAccounting === true ? null : true)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${hasAccounting === true
                        ? 'bg-blue-100 text-blue-700 border-blue-200 shadow-sm'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                        }`}
                >
                    Har regnskap
                </button>
                <button
                    onClick={() => setInLiquidation(inLiquidation === true ? null : true)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${inLiquidation === true
                        ? 'bg-orange-100 text-orange-700 border-orange-200 shadow-sm'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                        }`}
                >
                    Avvikling
                </button>
            </div>
        </section>
    );
};
