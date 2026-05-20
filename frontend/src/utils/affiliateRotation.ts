import type { Affiliation } from '../constants/affiliations'

function hashString(value: string): number {
    let hash = 0
    for (let index = 0; index < value.length; index += 1) {
        hash = Math.imul(31, hash) + value.charCodeAt(index)
    }
    return Math.abs(hash)
}

export function selectRotatingAffiliation(
    candidates: Affiliation[],
    placement: string,
    rotationDate = new Date()
): Affiliation | null {
    if (candidates.length === 0) return null

    const dayKey = Math.floor(rotationDate.getTime() / 86_400_000)
    const index = hashString(`${placement}:${dayKey}`) % candidates.length
    return candidates[index]
}