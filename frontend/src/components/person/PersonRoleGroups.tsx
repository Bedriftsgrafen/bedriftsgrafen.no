import { memo } from 'react'
import type { PersonRole } from '../../types/person'
import { PersonRoleCard } from './PersonRoleCard'

const ROLE_GROUPS: { label: string; codes: Set<string> }[] = [
    { label: 'Lederroller', codes: new Set(['DAGL', 'LEDE', 'BOBE']) },
    { label: 'Styreroller', codes: new Set(['STYR', 'NEST', 'VARA', 'MEDL']) },
]

interface RoleGroup {
    label: string
    roles: PersonRole[]
}

function groupRoles(roles: PersonRole[]): RoleGroup[] {
    const groups: RoleGroup[] = ROLE_GROUPS.map(g => ({ label: g.label, roles: [] }))
    const other: PersonRole[] = []

    for (const role of roles) {
        const matched = ROLE_GROUPS.findIndex(g => g.codes.has(role.type_kode))
        if (matched >= 0) {
            groups[matched].roles.push(role)
        } else {
            other.push(role)
        }
    }

    if (other.length > 0) {
        groups.push({ label: 'Andre roller', roles: other })
    }

    // Only return non-empty groups
    return groups.filter(g => g.roles.length > 0)
}

interface PersonRoleGroupProps {
    roles: PersonRole[]
}

export const PersonRoleGroups = memo(function PersonRoleGroups({ roles }: PersonRoleGroupProps) {
    const groups = groupRoles(roles)

    return (
        <div className="space-y-8">
            {groups.map(group => (
                <section key={group.label}>
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                        {group.label}
                        <span className="ml-2 text-gray-300 font-normal">({group.roles.length})</span>
                    </h3>
                    <div className="grid gap-3">
                        {group.roles.map((role, idx) => (
                            <PersonRoleCard key={`${role.orgnr}-${role.type_kode}-${idx}`} role={role} />
                        ))}
                    </div>
                </section>
            ))}
        </div>
    )
})
