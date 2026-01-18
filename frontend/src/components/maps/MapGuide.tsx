import { Info, Map as MapIcon, Users, Filter, MousePointer2, Building } from 'lucide-react'

export function MapGuide() {
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
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8 overflow-hidden relative group">
            {/* Decorative background element */}
            <div className="absolute -right-8 -top-8 w-32 h-32 bg-blue-50 rounded-full opacity-50 group-hover:scale-110 transition-transform duration-700"></div>

            <div className="flex items-center gap-2 mb-4">
                <div className="bg-blue-600/10 p-1.5 rounded-lg">
                    <Info className="h-5 w-5 text-blue-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Slik bruker du kartet</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
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
    )
}
