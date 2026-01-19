import { Calculator, type LucideIcon } from 'lucide-react'
import tjenestetorgetLogo from '../assets/affiliates/tjenestetorget.png'

export interface Affiliation {
    id: string
    name: string
    title: string
    description: string
    buttonText: string
    link: string
    icon: LucideIcon
    logo?: string
    variant: 'accounting' | 'banking' | 'general'
}

export const AFFILIATIONS = {
    TJENESTETORGET_ACCOUNTANT: {
        id: 'tjenestetorget_accountant',
        name: 'Tjenestetorget',
        title: 'Finn regnskapsfører – enkelt og uforpliktende',
        description: 'Sammenlign tilbud fra flere regnskapsførere som kjenner din bransje. Spar tid og penger!',
        buttonText: 'Sammenlign tilbud',
        link: 'https://go.adt246.net/t/t?a=1994251917&as=2036739113&t=2&tk=1',
        icon: Calculator,
        logo: tjenestetorgetLogo,
        variant: 'accounting',
    } as Affiliation,
} as const
