import { useState } from 'react'
import { Info, Map as MapIcon, Users, Filter, MousePointer2, Building, ChevronDown, ChevronUp } from 'lucide-react'
import clsx from 'clsx'

export function MapGuide() {
    const [isOpen, setIsOpen] = useState(false)

    const steps = [
        {
            icon: MapIcon,
            title: 'Velg nivå',
            description: 'Bytt mellom fylker og kommuner for å se data i ulike skalaer.',
            color: 'text-blue-600',
            bgColor: 'bg-blue-50'
        },
        {
            icon: Users,
            title: 'Per innbygger',
            description: 'Se bedriftstetthet i forhold til befolkning med "Per innbygger"-knappen.',
            color: 'text-purple-600',
            bgColor: 'bg-purple-50'
        },
        {
            icon: Filter,
            title: 'Filtrer bransje',
            description: 'Bruk bransjevelgeren for å se geografisk spredning av spesifikke sektorer.',
            color: 'text-emerald-600',
            bgColor: 'bg-emerald-50'
        },
        {
            icon: MousePointer2,
            title: 'Utforsk region',
            description: 'Klikk på et område for å se nøkkeltall og gå videre til bedriftsoversikt.',
            color: 'text-amber-600',
            bgColor: 'bg-amber-50'
        },
        {
            icon: Building,
            title: 'Finn bedrifter',
            description: 'Zoom inn eller filtrer bransjer for å se individuelle bedrifter i kartet.',
            color: 'text-red-600',
            bgColor: 'bg-red-50'
        }
    ]

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-8 overflow-hidden relative group transition-all duration-300">
            {/* Decorative background element */}
            <div className="absolute -right-8 -top-8 w-32 h-32 bg-blue-50 rounded-full opacity-50 group-hover:scale-110 transition-transform duration-700 pointer-events-none"></div>

            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-4 md:p-6 hover:bg-slate-50 transition-colors"
                aria-expanded={isOpen}
            >
                <div className="flex items-center gap-3">
                    <div className="bg-blue-600/10 p-1.5 rounded-lg">
                        <Info className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="text-left">
                        <h2 className="text-lg md:text-xl font-bold text-gray-900">Slik bruker du kartet</h2>
                        {!isOpen && (
                            <p className="text-gray-500 text-xs mt-0.5 hidden md:block">
                                Lær hvordan du bruker filtre, nivåer og utforsker bedrifter i kartet.
                            </p>
                        )}
                    </div>
                </div>
                {isOpen ? (
                    <ChevronUp className="h-5 w-5 text-gray-400" />
                ) : (
                    <ChevronDown className="h-5 w-5 text-gray-400" />
                )}
            </button>

            <div className={clsx(
                "transition-all duration-300 ease-in-out",
                isOpen ? "max-h-[1000px] opacity-100 p-6 pt-0" : "max-h-0 opacity-0 overflow-hidden"
            )}>
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6 border-t border-gray-50 pt-6">
                    {steps.map((step, idx) => (
                        <div key={idx} className="flex flex-col gap-3">
                            <div className={`${step.bgColor} ${step.color} w-10 h-10 rounded-lg flex items-center justify-center shadow-sm`}>
                                <step.icon className="h-5 w-5" />
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-900 text-sm mb-1">{step.title}</h3>
                                <p className="text-gray-500 text-xs leading-relaxed">
                                    {step.description}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
