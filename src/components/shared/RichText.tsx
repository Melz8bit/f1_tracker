// Renders **bold** markers from race facts and raceNotes.json. Nothing else is interpreted.
export default function RichText({ text }: { text: string }) {
    return (
        <>
            {text.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
                part.startsWith('**') && part.endsWith('**')
                    ? <strong key={i}>{part.slice(2, -2)}</strong>
                    : part
            )}
        </>
    )
}
