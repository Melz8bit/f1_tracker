// Flag images rather than emoji: Windows renders flag emoji as plain letters ("GB").
const NATIONALITY_TO_ISO: Record<string, string> = {
    American: 'us', Argentine: 'ar', Australian: 'au', Austrian: 'at', Belgian: 'be',
    Brazilian: 'br', British: 'gb', Canadian: 'ca', Chinese: 'cn', Colombian: 'co',
    Danish: 'dk', Dutch: 'nl', Estonian: 'ee', Finnish: 'fi', French: 'fr', German: 'de',
    Indian: 'in', Indonesian: 'id', Irish: 'ie', Italian: 'it', Japanese: 'jp', Mexican: 'mx',
    Monegasque: 'mc', 'New Zealander': 'nz', Polish: 'pl', Russian: 'ru', Spanish: 'es',
    Swedish: 'se', Swiss: 'ch', Thai: 'th', Venezuelan: 've',
}

interface DriverFlagProps {
    nationality: string;
}

export default function DriverFlag({ nationality }: DriverFlagProps) {
    const iso = NATIONALITY_TO_ISO[nationality]
    if (!iso) return <span className="inline-block w-5" title={nationality} />
    return (
        <img
            src={`https://flagcdn.com/w40/${iso}.png`}
            alt={nationality}
            title={nationality}
            width={20}
            height={14}
            className="rounded-sm object-cover shrink-0"
            loading="lazy"
        />
    )
}
