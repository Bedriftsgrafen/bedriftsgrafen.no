/* eslint-disable react-refresh/only-export-components */
import { createLazyFileRoute } from '@tanstack/react-router'
import { SEOHead } from '../components/layout'
import { CapabilityGrid } from '../components/home/CapabilityGrid'
import { HeroSearch } from '../components/home/HeroSearch'
import { LiveDataPanel } from '../components/home/LiveDataPanel'
import { PersonalSection } from '../components/home/PersonalSection'
import { TrustMetrics } from '../components/home/TrustMetrics'

export const Route = createLazyFileRoute('/')(
    {
        component: HomePage,
    })

export function HomePage() {
    return (
        <div className="-mx-4 -my-8 bg-[linear-gradient(180deg,#eef3f8_0%,#f6f8fb_24%,#edf2f7_100%)] px-4 py-8 [&>section:last-of-type]:mb-0">
            <SEOHead />
            <HeroSearch />
            <TrustMetrics />
            <CapabilityGrid />
            <LiveDataPanel />
            <PersonalSection />
        </div>
    )
}
