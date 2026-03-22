import { createFileRoute, redirect } from '@tanstack/react-router'

interface PersonSearchParams {
    name: string
    birthdate: string
}

export const Route = createFileRoute('/person/$name/$birthdate')({
    params: {
        parse: (params): PersonSearchParams => {
            return {
                name: decodeURIComponent(params.name),
                birthdate: params.birthdate
            }
        },
        stringify: (params) => ({
            name: encodeURIComponent(params.name),
            birthdate: params.birthdate,
        }),
    },
    beforeLoad: ({ params }) => {
        // GDPR: Redirect full-date URLs (e.g. /person/Name/1996-03-12) to year-only
        // 301 permanent — nginx handles server-side redirect for bots; this is a SPA fallback
        if (/^\d{4}-\d{2}-\d{2}$/.test(params.birthdate)) {
            const year = params.birthdate.slice(0, 4)
            throw redirect({
                to: '/person/$name/$birthdate',
                params: { name: params.name, birthdate: year },
                statusCode: 301,
            })
        }
    },
    loader: ({ params }) => {
        return {
            name: decodeURIComponent(params.name),
            birthdate: params.birthdate === 'unknown' ? null : params.birthdate
        }
    }
})
