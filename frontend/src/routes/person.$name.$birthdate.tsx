import { createFileRoute } from '@tanstack/react-router'

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
    loader: ({ params }) => {
        return {
            name: decodeURIComponent(params.name),
            birthdate: params.birthdate === 'unknown' ? null : params.birthdate
        }
    }
})
