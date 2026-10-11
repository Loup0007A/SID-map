import { isImageIcon } from '@/lib/icons';

// Affiche une icône : emoji tel quel, ou image importée à la taille du texte.
export default function Icon({ value, className = '' }: { value: string | null | undefined; className?: string }) {
  if (isImageIcon(value))
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={value} alt="" draggable={false} className={`inline-block h-[1.2em] w-[1.2em] object-contain align-[-0.22em] ${className}`} />
    );
  return <>{value}</>;
}
