import { useId, useState } from 'react'
import { AlertTriangle, CheckCircle2, Mail } from 'lucide-react'
import { Modal } from '../common'
import { CONTACT_EMAIL, getContactGmailComposeHref } from '../../constants/contact'

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
    const modalId = useId()
    const checkboxId = useId()
    const copy = CONTACT_COPY[intent]
    const contextCopy = CONTEXT_COPY[context]
    const canOpenEmail = !requiresConfirmation || confirmed
    const emailHref = intent === 'general'
        ? getContactGmailComposeHref()
        : getContactGmailComposeHref(copy.subject)
    const titleId = `${modalId}-title`
    const descriptionId = `${modalId}-description`

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            maxWidth="max-w-2xl"
            ariaLabelledBy={titleId}
            ariaDescribedBy={descriptionId}
        >
            <div className="space-y-6">
                <div className="flex items-start gap-4 pr-8">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-blue-700 ring-1 ring-slate-200 shadow-[0_16px_32px_-24px_rgba(15,23,42,0.3)] dark:bg-blue-500/12 dark:text-blue-200 dark:ring-blue-300/20">
                        <Mail className="h-6 w-6" aria-hidden="true" />
                    </div>
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700 dark:text-blue-300">Kontakt</p>
                        <h2 id={titleId} className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">{copy.title}</h2>
                        <p id={descriptionId} className="mt-2 text-base leading-7 text-slate-600 dark:text-slate-300">{copy.lead}</p>
                    </div>
                </div>

                <div className="rounded-2xl border border-amber-300/80 bg-[linear-gradient(180deg,rgba(255,251,235,1),rgba(255,247,237,1))] p-5 text-amber-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] dark:border-amber-400/30 dark:bg-amber-500/10 dark:bg-none dark:text-amber-100 dark:shadow-none">
                    <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/70 text-amber-600 ring-1 ring-amber-200/80 dark:bg-amber-400/10 dark:text-amber-200 dark:ring-amber-300/25">
                            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
                        </div>
                        <div>
                            <p className="text-lg font-semibold tracking-tight">{contextCopy.warningTitle}</p>
                            <p className="mt-2 text-sm leading-7 text-amber-900/90 dark:text-amber-100/85">
                                {contextCopy.warningBody}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="grid gap-4 text-sm text-slate-700 dark:text-slate-200 sm:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 shadow-[0_12px_32px_-28px_rgba(15,23,42,0.24)] dark:border-emerald-400/25 dark:bg-emerald-500/10 dark:shadow-none">
                        <div className="mb-3 flex items-center gap-2 font-semibold text-slate-950 dark:text-emerald-100">
                            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-emerald-300" aria-hidden="true" />
                            Send gjerne
                        </div>
                        <ul role="list" className="space-y-2 text-slate-600 dark:text-slate-200">
                            {contextCopy.sendItems.map((item) => (
                                <li key={item} className="flex items-start gap-2">
                                    <span aria-hidden="true" className="mt-2.25 h-1.5 w-1.5 rounded-full bg-green-500 dark:bg-emerald-300" />
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_12px_32px_-28px_rgba(15,23,42,0.2)] dark:border-amber-400/25 dark:bg-slate-950/70 dark:shadow-none">
                        <div className="mb-3 flex items-center gap-2 font-semibold text-slate-950 dark:text-amber-100">
                            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-300" aria-hidden="true" />
                            Send ikke
                        </div>
                        <ul role="list" className="space-y-2 text-slate-600 dark:text-slate-200">
                            {contextCopy.dontSendItems.map((item) => (
                                <li key={item} className="flex items-start gap-2">
                                    <span aria-hidden="true" className="mt-2.25 h-1.5 w-1.5 rounded-full bg-amber-500 dark:bg-amber-300" />
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                {requiresConfirmation && (
                    <label htmlFor={checkboxId} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-sm leading-6 text-slate-700 shadow-[0_12px_32px_-28px_rgba(15,23,42,0.24)] dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-200 dark:shadow-none">
                        <input
                            id={checkboxId}
                            type="checkbox"
                            checked={confirmed}
                            onChange={(event) => setConfirmed(event.target.checked)}
                            className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-950 dark:focus:ring-blue-300"
                        />
                        <span>{contextCopy.confirmation}</span>
                    </label>
                )}

                <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-2 dark:border-slate-800 sm:flex-row sm:justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:ring-offset-2 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 dark:focus-visible:ring-blue-300 dark:focus-visible:ring-offset-slate-900"
                    >
                        Avbryt
                    </button>
                    <a
                        href={emailHref}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(event) => {
                            if (!canOpenEmail) {
                                event.preventDefault()
                                return
                            }

                            onClose()
                        }}
                        aria-disabled={!canOpenEmail}
                        tabIndex={canOpenEmail ? undefined : -1}
                        className={`inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold shadow-[0_16px_32px_-20px_rgba(30,58,138,0.8)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:ring-offset-2 dark:focus-visible:ring-blue-300 dark:focus-visible:ring-offset-slate-900 ${canOpenEmail ? 'bg-blue-900 text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500' : 'cursor-not-allowed bg-slate-400 text-white shadow-none dark:bg-slate-700 dark:text-slate-300'}`}
                    >
                        Åpne e-post til {CONTACT_EMAIL}
                    </a>
                </div>
            </div>
        </Modal>
    )
}