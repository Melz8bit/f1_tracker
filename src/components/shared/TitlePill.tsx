import { TITLE_PILL, type TitleStatus } from '../../lib/championship'

export default function TitlePill({ status }: { status: TitleStatus }) {
    const pill = TITLE_PILL[status]
    return <span className={pill.className}>{pill.label}</span>
}
