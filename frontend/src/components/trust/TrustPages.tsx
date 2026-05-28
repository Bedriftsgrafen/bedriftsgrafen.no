import type { ComponentType, ReactNode } from 'react'
import type { LucideProps } from 'lucide-react'
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BookOpen,
  Building2,
  Database,
  ExternalLink,
  FileText,
  Globe2,
  MapPinned,
  RefreshCw,
  Scale,
  ShieldCheck,
  UserRoundCheck,
} from 'lucide-react'
import { BedriftsgrafenContactLink } from '../contact'

type IconComponent = ComponentType<LucideProps>

type TrustPageShellProps = {
  eyebrow: string
  title: string
  lead: string
  updatedAt: string
  icon: IconComponent
  children: ReactNode
}

type TrustSectionProps = {
  title: string
  lead?: string
  children: ReactNode
}

type TrustCardProps = {
  icon: IconComponent
  title: string
  children: ReactNode
}

const UPDATED_AT = '28. mai 2026'

const linkClass = 'font-semibold text-blue-700 underline underline-offset-4 transition-colors hover:text-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:ring-offset-2 dark:text-blue-300 dark:hover:text-blue-200 dark:focus-visible:ring-offset-slate-950'

function TrustPageShell({ eyebrow, title, lead, updatedAt, icon: Icon, children }: TrustPageShellProps) {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-white">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <header className="border-b border-slate-200 pb-8 dark:border-slate-800">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-400/30 dark:bg-blue-400/10 dark:text-blue-200">
              <Icon className="h-7 w-7" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase text-blue-700 dark:text-blue-300">{eyebrow}</p>
              <h1 className="mt-3 text-3xl font-semibold text-slate-950 dark:text-white sm:text-4xl">{title}</h1>
              <p className="mt-4 max-w-3xl text-base leading-8 text-slate-700 dark:text-slate-300 sm:text-lg">{lead}</p>
              <p className="mt-5 text-sm text-slate-500 dark:text-slate-400">Sist oppdatert: {updatedAt}</p>
            </div>
          </div>
        </header>

        <div className="mt-8 space-y-8">{children}</div>
      </div>
    </main>
  )
}

function TrustSection({ title, lead, children }: TrustSectionProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
      <h2 className="text-2xl font-semibold text-slate-950 dark:text-white">{title}</h2>
      {lead && <p className="mt-3 text-base leading-7 text-slate-600 dark:text-slate-300">{lead}</p>}
      <div className="mt-5">{children}</div>
    </section>
  )
}

function TrustCard({ icon: Icon, title, children }: TrustCardProps) {
  return (
    <article className="rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950/60">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-blue-700 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-blue-300 dark:ring-slate-700">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-slate-950 dark:text-white">{title}</h3>
          <div className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">{children}</div>
        </div>
      </div>
    </article>
  )
}

function PlainList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-3 text-sm leading-7 text-slate-700 dark:text-slate-300">
      {items.map((item) => (
        <li key={item} className="flex gap-3">
          <span aria-hidden="true" className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600 dark:bg-blue-300" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

function ExternalAnchor({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={linkClass}>
      {children}
      <ExternalLink className="ml-1 inline h-3.5 w-3.5" aria-hidden="true" />
    </a>
  )
}

export function DataSourcesPage() {
  return (
    <TrustPageShell
      eyebrow="Åpenhet"
      title="Datakilder og datakvalitet"
      lead="Bedriftsgrafen.no samler åpne norske registerdata og gjør dem enklere å søke i, sammenligne og forstå. Denne siden forklarer hvor dataene kommer fra, hvordan de oppdateres, og hva du bør kontrollere før du bruker dem til viktige beslutninger."
      updatedAt={UPDATED_AT}
      icon={Database}
    >
      <TrustSection title="Kildene vi bruker" lead="Vi skal være tydelige på hvilke kilder som faktisk inngår i tjenesten. Bedriftsgrafen.no er ikke et offisielt register og erstatter ikke originalkildene.">
        <div className="grid gap-4 md:grid-cols-2">
          <TrustCard icon={Building2} title="Brønnøysundregistrene">
            <p>
              Grunndata om virksomheter hentes fra Enhetsregisteret. Regnskapsdata hentes fra Regnskapsregisteret når slike data er tilgjengelige. Rolledata brukes for å vise offentlige rolleforhold knyttet til virksomheter og personer.
            </p>
          </TrustCard>
          <TrustCard icon={BarChart3} title="SSB">
            <p>
              Statistisk sentralbyrå brukes som kilde for offentlige geografiske og statistiske nøkkeltall der dette er relevant for region-, fylke- og kommunevisninger.
            </p>
          </TrustCard>
          <TrustCard icon={MapPinned} title="Kartverket">
            <p>
              Kart- og adressegrunnlag brukes for geografisk presentasjon. Koordinater og plasseringer kan være avrundet, avledet eller mangelfulle.
            </p>
          </TrustCard>
          <TrustCard icon={Activity} title="Bedriftsgrafens aktivitetslogg">
            <p>
              Siden <a href="/oppdateringer?tab=datastatus" className={linkClass}>Oppdateringer og datastatus</a> viser når Bedriftsgrafen sist observerte og behandlet nye data fra kildene.
            </p>
          </TrustCard>
        </div>
      </TrustSection>

      <TrustSection title="Oppdatering og ferskhet" lead="Vi skiller mellom når noe skjedde i kilden og når Bedriftsgrafen oppdaget eller importerte det.">
        <PlainList items={[
          'Virksomhetsendringer behandles fra åpne oppdateringsstrømmer hos Brønnøysundregistrene når de er tilgjengelige for tjenesten.',
          'Regnskapsoppdateringer betyr at Bedriftsgrafen har lagt til eller oppdatert et regnskap i vår database. Det er ikke nødvendigvis det samme som juridisk innsendingsdato.',
          'Datastatus og siste aktivitet vises på /oppdateringer, slik at du kan se om kildene nylig er synkronisert.',
        ]} />
      </TrustSection>

      <TrustSection title="Begrensninger du bør kjenne til">
        <div className="grid gap-4 md:grid-cols-2">
          <TrustCard icon={AlertTriangle} title="Data kan være feil eller ufullstendige">
            <p>
              Offentlige registerdata kan inneholde forsinkelser, manglende felt, historiske avvik eller feil fra kilden. Noen virksomheter har ikke regnskapsplikt, og noen regnskap kan mangle eller være vanskelige å tolke maskinelt.
            </p>
          </TrustCard>
          <TrustCard icon={FileText} title="Ikke et kreditt- eller juridisk produkt">
            <p>
              Bedriftsgrafen.no gir generell innsikt og sammenstilling. Bruk offisielle registre, profesjonell rådgivning og egne kontroller før juridiske, økonomiske eller kommersielle beslutninger.
            </p>
          </TrustCard>
        </div>
      </TrustSection>

      <TrustSection title="Rettelser og kildeansvar" lead="Feil som stammer fra offentlige registre må normalt rettes hos kilden først.">
        <PlainList items={[
          'Hvis opplysningene er feil i Enhetsregisteret eller Regnskapsregisteret, må virksomheten eller rette part oppdatere dem via Brønnøysundregistrene/Altinn.',
          'Hvis Bedriftsgrafen viser noe annerledes enn kilden, eller en oppdatering ikke har slått inn hos oss, kan du kontakte oss om visningsfeilen.',
          'Vi kan ikke garantere at offentlige opplysninger fjernes fra tjenesten hvis de fortsatt er lovlig publisert hos kilden, men vi vurderer personvern- og feilrettingssaker konkret.',
        ]} />
      </TrustSection>

      <TrustSection title="Originalkilder">
        <div className="flex flex-col gap-3 text-sm text-slate-700 dark:text-slate-300 sm:flex-row sm:flex-wrap">
          <ExternalAnchor href="https://data.brreg.no">Brønnøysundregistrene</ExternalAnchor>
          <ExternalAnchor href="https://www.ssb.no">Statistisk sentralbyrå</ExternalAnchor>
          <ExternalAnchor href="https://www.kartverket.no">Kartverket</ExternalAnchor>
        </div>
      </TrustSection>
    </TrustPageShell>
  )
}

export function PrivacyPage() {
  return (
    <TrustPageShell
      eyebrow="Personvern"
      title="Personvern og behandling av opplysninger"
      lead="Bedriftsgrafen.no viser hovedsakelig offentlige registeropplysninger om norske virksomheter og roller. Vi forsøker å begrense personopplysninger til det som er nødvendig for å forstå offentlige rolleforhold og for å drifte tjenesten trygt."
      updatedAt={UPDATED_AT}
      icon={ShieldCheck}
    >
      <TrustSection title="Hvilke opplysninger som behandles">
        <div className="grid gap-4 md:grid-cols-2">
          <TrustCard icon={Building2} title="Virksomhetsopplysninger">
            <p>
              Navn, organisasjonsnummer, adresse, næringskode, organisasjonsform, ansatte, status og regnskap kan vises når opplysningene finnes i offentlige kilder.
            </p>
          </TrustCard>
          <TrustCard icon={UserRoundCheck} title="Rolle- og personopplysninger">
            <p>
              Offentlige rolleforhold kan vises med navn, rolle, tilknyttet virksomhet og fødselsår der dette er del av åpne registerdata. Vi viser ikke fødselsnummer.
            </p>
          </TrustCard>
          <TrustCard icon={Globe2} title="Tekniske logger">
            <p>
              Servere og sikkerhetssystemer kan lagre tekniske logger, for eksempel tidspunkt, URL, IP-adresse, nettleserinformasjon og feilstatus, for drift, sikkerhet og feilsøking.
            </p>
          </TrustCard>
          <TrustCard icon={Activity} title="Analyse og lokal lagring">
            <p>
              Bedriftsgrafen.no bruker Google Analytics 4 med IP-anonymisering og annonsepersonalisering deaktivert. Nettleseren kan også lagre lokale hendelser og innstillinger for å forbedre brukeropplevelsen.
            </p>
          </TrustCard>
        </div>
      </TrustSection>

      <TrustSection title="Formål og grunnlag" lead="Formålet er å gjøre offentlige virksomhetsdata mer tilgjengelige, søkbare og forståelige.">
        <PlainList items={[
          'Offentlige registeropplysninger behandles for å gi allmenn innsikt i norske virksomheter, roller og regnskap.',
          'Tekniske logger behandles for sikkerhet, stabilitet, feilsøking og misbruksbeskyttelse.',
          'Analyse brukes for å forstå hvilke deler av tjenesten som fungerer, hvor ytelsen bør forbedres og hvilke feil brukere møter.',
        ]} />
      </TrustSection>

      <TrustSection title="Informasjonskapsler og sporing">
        <PlainList items={[
          'Google Analytics kan sette informasjonskapsler eller lagre teknisk informasjon for trafikkmåling når analyse lastes inn.',
          'Analyse er konfigurert uten Google Signals og uten annonsepersonalisering.',
          'Du kan begrense eller slette informasjonskapsler i nettleseren. Noen lokale innstillinger kan da bli nullstilt.',
        ]} />
      </TrustSection>

      <TrustSection title="Lagring, deling og ansvar" lead="Bedriftsgrafen.no er ansvarlig for behandlingen som skjer i denne tjenesten. Offentlige registre er ansvarlige for egne registeropplysninger hos kilden.">
        <PlainList items={[
          'Offentlige registerdata lagres så lenge de er relevante for tjenesten, kildegrunnlaget og historiske analyser.',
          'Tekniske logger lagres bare så lenge det er nødvendig for drift, sikkerhet, feilsøking og misbruksbeskyttelse.',
          'Analysehendelser kan behandles av Google Analytics. Vi selger ikke personopplysninger og bruker ikke analyse til annonsepersonalisering.',
        ]} />
      </TrustSection>

      <TrustSection title="Retting, sletting og innsyn" lead="Hvis opplysninger er feil i et offentlig register, bør feilen rettes hos originalkilden. Vi kan likevel undersøke visningsfeil, åpenbare mismatch eller personvernhensyn i Bedriftsgrafen.">
        <PlainList items={[
          'Du kan be om innsyn i hvilke opplysninger Bedriftsgrafen behandler om deg der vi har mulighet til å identifisere dem.',
          'Du kan be oss vurdere retting, begrensning eller sletting når opplysningene er feil hos oss eller behandlingen skaper et konkret personvernproblem.',
          'Vi kan ikke alltid fjerne offentlige registeropplysninger som fortsatt er lovlig publisert hos kilden, men vi vurderer henvendelser konkret.',
        ]} />
        <BedriftsgrafenContactLink
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-blue-900 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:ring-offset-2 dark:bg-blue-600 dark:hover:bg-blue-500 dark:focus-visible:ring-offset-slate-950"
          context="person"
        >
          Kontakt oss om personvern
        </BedriftsgrafenContactLink>
      </TrustSection>
    </TrustPageShell>
  )
}

export function TermsPage() {
  return (
    <TrustPageShell
      eyebrow="Vilkår"
      title="Vilkår for bruk"
      lead="Bedriftsgrafen.no er laget for raske søk, sammenligning og generell innsikt i norske virksomheter. Ved å bruke tjenesten godtar du at innholdet brukes ansvarlig og kontrolleres mot originalkilder når det har betydning."
      updatedAt={UPDATED_AT}
      icon={Scale}
    >
      <TrustSection title="Hva tjenesten er">
        <div className="grid gap-4 md:grid-cols-2">
          <TrustCard icon={BookOpen} title="Sammenstilling av åpne data">
            <p>
              Tjenesten henter, strukturerer og viser offentlige data fra kilder som Brønnøysundregistrene, SSB og Kartverket. Bedriftsgrafen.no er ikke en offentlig myndighet og utsteder ikke offisielle registerutskrifter.
            </p>
          </TrustCard>
          <TrustCard icon={RefreshCw} title="Løpende forbedring">
            <p>
              Funksjoner, datamodeller, visninger og oppdateringsrutiner kan endres uten forhåndsvarsel når tjenesten forbedres eller kildeformatene endrer seg.
            </p>
          </TrustCard>
        </div>
      </TrustSection>

      <TrustSection title="Ansvar og beslutninger">
        <PlainList items={[
          'Data kan være forsinket, ufullstendig, feil tolket eller mangle historikk. Kontroller alltid viktige opplysninger hos originalkilden.',
          'Bedriftsgrafen.no skal ikke brukes som eneste grunnlag for juridiske, finansielle, kredittmessige, ansettelsesmessige eller andre viktige beslutninger.',
          'KPI-er, grafer og analyser er for generell innsikt. De kan bygge på mangelfulle regnskapsfelt og er ikke rådgivning.',
        ]} />
      </TrustSection>

      <TrustSection title="Tillatt bruk">
        <PlainList items={[
          'Du kan bruke tjenesten til normale søk, sammenligning, research og lenking til relevante sider.',
          'Ikke bruk automatisert trafikk, scraping eller masseuthenting som belaster tjenesten, omgår begrensninger eller gjenpubliserer store deler av databasen.',
          'For større databehov bør du bruke originalkilder og deres offisielle vilkår, API-er og nedlastinger.',
        ]} />
      </TrustSection>

      <TrustSection title="Kode, innhold og tilgjengelighet">
        <div className="grid gap-4 md:grid-cols-2">
          <TrustCard icon={FileText} title="Kode og presentasjon">
            <p>
              Kildekoden til prosjektet er åpen under MIT-lisens der den er publisert på GitHub. Nettsidens sammenstilling, design og tekster kan likevel ikke brukes på en måte som forveksles med Bedriftsgrafen.no.
            </p>
          </TrustCard>
          <TrustCard icon={AlertTriangle} title="Ingen garantert tilgjengelighet">
            <p>
              Tjenesten kan være utilgjengelig, treg eller midlertidig feil som følge av vedlikehold, kapasitetsgrenser, kildeproblemer eller tekniske feil.
            </p>
          </TrustCard>
        </div>
      </TrustSection>

      <TrustSection title="Kontakt">
        <p className="text-sm leading-7 text-slate-700 dark:text-slate-300">
          Spørsmål om vilkår, feil i visningen eller ansvarlig bruk kan sendes til Bedriftsgrafen.no. Ikke send meldinger som egentlig skal til virksomheter eller personer omtalt på siden.
        </p>
        <BedriftsgrafenContactLink
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-blue-900 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:ring-offset-2 dark:bg-blue-600 dark:hover:bg-blue-500 dark:focus-visible:ring-offset-slate-950"
        >
          Kontakt Bedriftsgrafen.no
        </BedriftsgrafenContactLink>
      </TrustSection>
    </TrustPageShell>
  )
}