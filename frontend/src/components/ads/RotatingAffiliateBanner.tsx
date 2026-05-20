import { useMemo } from 'react'
import { AffiliateBanner } from './AffiliateBanner'
import type { Affiliation, AffiliateCopyOverrides } from '../../constants/affiliations'
import { selectRotatingAffiliation } from '../../utils/affiliateRotation'

interface RotatingAffiliateBannerProps {
    placement: string
    candidates: Affiliation[]
    className?: string
    copyOverrides?: AffiliateCopyOverrides
    rotationDate?: Date
}

export function RotatingAffiliateBanner({
    placement,
    candidates,
    className,
    copyOverrides,
    rotationDate,
}: RotatingAffiliateBannerProps) {
    const affiliation = useMemo(
        () => selectRotatingAffiliation(candidates, placement, rotationDate),
        [candidates, placement, rotationDate]
    )

    if (!affiliation) return null

    const copyOverride = copyOverrides?.[affiliation.id]
    const bannerAffiliation = { ...affiliation, ...copyOverride }

    return (
        <div className={className}>
            <AffiliateBanner
                bannerId={`${placement}_${bannerAffiliation.id}`}
                placement={placement}
                legalTextMode="inline"
                {...bannerAffiliation}
            />
        </div>
    )
}