export default function Rarity({ value, className = '' }: { value: number | null | undefined; className?: string }) {
  if (!value) return null;
  return (
    <span className={`inline-flex items-center text-brass-500 ${className}`} title={`Rareté ${value}/8`} aria-label={`Rareté ${value} sur 8`}>
      {Array.from({ length: value }, (_, i) => (
        <span key={i}>★</span>
      ))}
    </span>
  );
}
