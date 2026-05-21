import { Calculator, CreditCard, Landmark, type LucideIcon } from 'lucide-react'
import klikklaanLogo from '../assets/affiliates/klikklaan-135x40.png'
import tjenestetorgetLogo from '../assets/affiliates/tjenestetorget-120x40.png'
import zensumLogo from '../assets/affiliates/zensum.svg'

export interface Affiliation {
    id: string
    name: string
    title: string
    description: string
    buttonText: string
    link: string
    icon: LucideIcon
    logo?: string
    logoWidth?: number
    logoHeight?: number
    variant: 'accounting' | 'banking' | 'general'
    legalText?: string
    isPlaceholder?: boolean
}

export type AffiliateCopy = Partial<Pick<Affiliation, 'title' | 'description' | 'buttonText' | 'legalText'>>

export type AffiliateCopyOverrides = Record<string, AffiliateCopy>

const AFFILIATE_REDIRECT_BASE = '/api/v1/affiliates'

export const AFFILIATE_LINKS = {
    tjenestetorget: `${AFFILIATE_REDIRECT_BASE}/tjenestetorget`,
    klikklaan: `${AFFILIATE_REDIRECT_BASE}/klikklaan`,
    zensum: `${AFFILIATE_REDIRECT_BASE}/zensum`,
} as const

export const AFFILIATIONS = {
    TJENESTETORGET_ACCOUNTANT: {
        id: 'tjenestetorget_accountant',
        name: 'Tjenestetorget',
        title: 'Finn regnskapsfører hos Tjenestetorget',
        description: 'Sammenlign tilbud fra flere regnskapsførere som kjenner din bransje.',
        buttonText: 'Sammenlign tilbud hos Tjenestetorget',
        link: AFFILIATE_LINKS.tjenestetorget,
        icon: Calculator,
        logo: tjenestetorgetLogo,
        logoWidth: 120,
        logoHeight: 40,
        variant: 'accounting',
    } as Affiliation,
    KLIKKLAAN_LOAN: {
        id: 'klikklaan_loan',
        name: 'KlikkLån',
        title: 'Lån opptil 70 000 kr hos KlikkLån',
        description: 'Kontantlån uten sikkerhet med valgfri nedbetaling fra 24 til 60 måneder. Søknad signeres med BankID.',
        buttonText: 'Se lånemuligheter hos KlikkLån',
        link: AFFILIATE_LINKS.klikklaan,
        icon: CreditCard,
        logo: klikklaanLogo,
        logoWidth: 135,
        logoHeight: 40,
        variant: 'general',
        legalText: 'Nominell rente fra 12,0 % til 26,40 %, basert på individuell kredittvurdering. Eksempel: nominell rente 20,40 % med avtalegiro, effektiv rente 28,68 %, kostnad 11 005 kr, totalt 36 005 kr. For å søke må du være over 21 år, ha bodd i Norge i 2 år og ikke ha betalingsanmerkninger.',
    } as Affiliation,
    ZENSUM_LOAN: {
        id: 'zensum_loan',
        name: 'Zensum',
        title: 'Sammenlign lån og refinansiering hos Zensum',
        description: 'Zensum sammenligner tilbud fra flere banker for forbrukslån og refinansiering.',
        buttonText: 'Sammenlign tilbud hos Zensum',
        link: AFFILIATE_LINKS.zensum,
        icon: Landmark,
        logo: zensumLogo,
        variant: 'general',
        legalText: 'Eksempel lån uten sikkerhet: 150 000 kr over 5 år, nominell rente 10,90 %, effektiv rente 11,46 %, kostnad 45 234 kr, totalt 195 240 kr, 3 254 kr per måned. Nedbetalingstid 1-15 år, 5 år dersom du ikke skal refinansiere.',
    } as Affiliation,
} as const

export const GLOBAL_AFFILIATIONS: Affiliation[] = [
    AFFILIATIONS.TJENESTETORGET_ACCOUNTANT,
    AFFILIATIONS.KLIKKLAAN_LOAN,
    AFFILIATIONS.ZENSUM_LOAN,
]
