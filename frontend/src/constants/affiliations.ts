import { Calculator, CreditCard, Landmark, ShieldCheck, TrendingDown, WalletCards, type LucideIcon } from 'lucide-react'
import klikklaanLogo from '../assets/affiliates/klikklaan-135x40.png'
import rentesjekkLogo from '../assets/affiliates/Rentesjekk.png'
import tjenestetorgetLogo from '../assets/affiliates/tjenestetorget-120x40.png'
import uscoreLogo from '../assets/affiliates/uScore.png'
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
    rentesjekk: `${AFFILIATE_REDIRECT_BASE}/rentesjekk`,
    tjenestetorgetForsikring: `${AFFILIATE_REDIRECT_BASE}/tjenestetorget-forsikring`,
    uscore: `${AFFILIATE_REDIRECT_BASE}/uscore`,
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
    RENTESJEKK_DEBT: {
        id: 'rentesjekk_debt',
        name: 'Rentesjekk.no',
        title: 'Sjekk om du kan få bedre rente hos Rentesjekk.no',
        description: 'Gratis og uforpliktende rentesjekk for forbrukslån og kredittkortgjeld via Vipps eller BankID.',
        buttonText: 'Start rentesjekk hos Rentesjekk.no',
        link: AFFILIATE_LINKS.rentesjekk,
        icon: TrendingDown,
        logo: rentesjekkLogo,
        logoWidth: 300,
        logoHeight: 100,
        variant: 'general',
        legalText: 'Rentesjekk.no er en gratis og uforpliktende tjeneste fra Zen Finans AS. Brukeren kan delta i konkurranse og gjennomføre rentesjekk for å undersøke om samarbeidspartnere kan tilby bedre betingelser på eksisterende lån eller kredittkortgjeld.',
    } as Affiliation,
    TJENESTETORGET_INSURANCE: {
        id: 'tjenestetorget_insurance',
        name: 'Tjenestetorget Forsikring',
        title: 'Sammenlign forsikring hos Tjenestetorget',
        description: 'Få oversikt og uforpliktende tilbud på bil-, innbo- eller reiseforsikring.',
        buttonText: 'Sammenlign forsikring hos Tjenestetorget',
        link: AFFILIATE_LINKS.tjenestetorgetForsikring,
        icon: ShieldCheck,
        logo: tjenestetorgetLogo,
        logoWidth: 120,
        logoHeight: 40,
        variant: 'general',
    } as Affiliation,
    USCORE_FINANCE: {
        id: 'uscore_finance',
        name: 'uScore',
        title: 'Få oversikt over privatøkonomien med uScore',
        description: 'Gratis økonomitjeneste for kredittsjekk, gjeldsoversikt, budsjett og personlige rentetilbud.',
        buttonText: 'Se økonomioversikt hos uScore',
        link: AFFILIATE_LINKS.uscore,
        icon: WalletCards,
        logo: uscoreLogo,
        logoWidth: 300,
        logoHeight: 100,
        variant: 'general',
    } as Affiliation,
} as const

export const ALL_AFFILIATIONS: Affiliation[] = [
    AFFILIATIONS.TJENESTETORGET_ACCOUNTANT,
    AFFILIATIONS.KLIKKLAAN_LOAN,
    AFFILIATIONS.ZENSUM_LOAN,
    AFFILIATIONS.RENTESJEKK_DEBT,
    AFFILIATIONS.TJENESTETORGET_INSURANCE,
    AFFILIATIONS.USCORE_FINANCE,
]

export const GLOBAL_AFFILIATION_LIMIT = 3

export const GLOBAL_AFFILIATIONS: Affiliation[] = ALL_AFFILIATIONS.slice(0, GLOBAL_AFFILIATION_LIMIT)
