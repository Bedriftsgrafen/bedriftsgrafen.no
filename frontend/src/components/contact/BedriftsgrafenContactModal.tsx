import { useId, useState } from 'react'
import { AlertTriangle, CheckCircle2, Mail } from 'lucide-react'
import { Modal } from '../common'
import { CONTACT_EMAIL, getContactEmailHref } from '../../constants/contact'

export type BedriftsgrafenContactIntent = 'general' | 'advertising' | 'partnership'
export type BedriftsgrafenContactContext = 'general' | 'company' | 'person'

const CONTACT_COPY: Record<BedriftsgrafenContactIntent, { title: string; subject: string; lead: string }> = {
    general: {
        title: 'Kontakt Bedriftsgrafen.no',
        subject: 'Spørsmål om Bedriftsgrafen.no',
        lead: 'Denne e-posten går til personen som driver Bedriftsgrafen.no.',
    },
    advertising: {
        title: 'Annonsere på Bedriftsgrafen.no',
        subject: 'Annonsering på Bedriftsgrafen.no',
        lead: 'Denne e-posten går til Bedriftsgrafen.no for spørsmål om annonseplass.',
    },
    partnership: {
        title: 'Partnerskap med Bedriftsgrafen.no',
        subject: 'Partnerskap med Bedriftsgrafen.no',
        lead: 'Denne e-posten går til Bedriftsgrafen.no for spørsmål om samarbeid.',
    },
}

const CONTEXT_COPY: Record<BedriftsgrafenContactContext, {
    warningTitle: string
    warningBody: string
    sendItems: string[]
    dontSendItems: string[]
    confirmation: string
}> = {
    general: {
        warningTitle: 'Du kontakter Bedriftsgrafen.no, ikke en virksomhet eller person omtalt på siden.',
        warningBody: 'Ikke send kundehenvendelser, private meldinger, faktura, bestillinger eller andre meldinger som egentlig skal til andre.',
        sendItems: ['Feil eller mangler i data', 'Spørsmål om nettsiden', 'Annonsering eller samarbeid'],
        dontSendItems: ['Kundeservice for virksomheter', 'Private meldinger til personer', 'Faktura, ordre eller jobbsøknader'],
        confirmation: 'Jeg forstår at meldingen sendes til Bedriftsgrafen.no, ikke en virksomhet eller person omtalt på siden.',
    },
    company: {
        warningTitle: 'Du kontakter Bedriftsgrafen.no, ikke virksomheten på siden.',
        warningBody: 'Ikke send kundehenvendelser, faktura, bestillinger, jobbsøknader eller andre meldinger som egentlig skal til virksomheten.',
        sendItems: ['Feil eller mangler i virksomhetsdata', 'Spørsmål om nettsiden', 'Annonsering eller samarbeid'],
        dontSendItems: ['Kundeservice for virksomheter', 'Faktura eller ordre', 'Jobb, booking eller klager'],
        confirmation: 'Jeg forstår at meldingen sendes til Bedriftsgrafen.no, ikke virksomheten jeg nettopp så på.',
    },
    person: {
        warningTitle: 'Du kontakter Bedriftsgrafen.no, ikke personen på siden.',
        warningBody: 'Ikke send private meldinger, jobbhenvendelser, salg, faktura eller andre beskjeder som egentlig skal til personen.',
        sendItems: ['Feil eller mangler i rolledata', 'Spørsmål om nettsiden', 'Annonsering eller samarbeid'],
        dontSendItems: ['Private henvendelser til personer', 'Salg, jobb eller booking', 'Faktura, klager eller andre beskjeder'],
        confirmation: 'Jeg forstår at meldingen sendes til Bedriftsgrafen.no, ikke personen jeg nettopp så på.',
    },
}

interface BedriftsgrafenContactModalProps {
    isOpen: boolean
    onClose: () => void
    intent?: BedriftsgrafenContactIntent
    context?: BedriftsgrafenContactContext
    requiresConfirmation?: boolean
}

export function BedriftsgrafenContactModal({
    isOpen,
    onClose,
    intent = 'general',
    context = 'general',
    requiresConfirmation = false,
}: BedriftsgrafenContactModalProps) {
    const [confirmed, setConfirmed] = useState(false)
    const checkboxId = useId()
    const copy = CONTACT_COPY[intent]
    const contextCopy = CONTEXT_COPY[context]
    const canOpenEmail = !requiresConfirmation || confirmed
    const emailHref = getContactEmailHref(copy.subject)

    return (
        <Modal isOpen={isOpen} onClose={onClose} maxWidth="max-w-xl">
            <div className="space-y-5">
                <div className="flex items-start gap-3 pr-8">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                        <Mail className="h-5 w-5" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">{copy.title}</h2>
                        <p className="mt-1 text-sm text-gray-600">{copy.lead}</p>
                    </div>
                </div>

                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-950">
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                        <div>
                            <p className="font-semibold">{contextCopy.warningTitle}</p>
                            <p className="mt-1 text-sm leading-relaxed">
                                {contextCopy.warningBody}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="grid gap-3 text-sm text-gray-700 sm:grid-cols-2">
                    <div className="rounded-lg border border-gray-200 p-3">
                        <div className="mb-2 flex items-center gap-2 font-semibold text-gray-900">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            Send gjerne
                        </div>
                        <ul className="space-y-1 text-gray-600">
                            {contextCopy.sendItems.map((item) => <li key={item}>{item}</li>)}
                        </ul>
                    </div>
                    <div className="rounded-lg border border-gray-200 p-3">
                        <div className="mb-2 flex items-center gap-2 font-semibold text-gray-900">
                            <AlertTriangle className="h-4 w-4 text-amber-600" />
                            Send ikke
                        </div>
                        <ul className="space-y-1 text-gray-600">
                            {contextCopy.dontSendItems.map((item) => <li key={item}>{item}</li>)}
                        </ul>
                    </div>
                </div>

                {requiresConfirmation && (
                    <label htmlFor={checkboxId} className="flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
                        <input
                            id={checkboxId}
                            type="checkbox"
                            checked={confirmed}
                            onChange={(event) => setConfirmed(event.target.checked)}
                            className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span>{contextCopy.confirmation}</span>
                    </label>
                )}

                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                    >
                        Avbryt
                    </button>
                    <a
                        href={emailHref}
                        onClick={(event) => {
                            if (!canOpenEmail) {
                                event.preventDefault()
                                return
                            }
                            onClose()
                        }}
                        aria-disabled={!canOpenEmail}
                        tabIndex={canOpenEmail ? undefined : -1}
                        className={`inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors ${canOpenEmail ? 'bg-blue-600 hover:bg-blue-700' : 'cursor-not-allowed bg-gray-400'}`}
                    >
                        Åpne e-post til {CONTACT_EMAIL}
                    </a>
                </div>
            </div>
        </Modal>
    )
}