'use client';

// Empile les boutons/pop-ups flottants du coin bas-droit (légende,
// présences, "ma position") du bas vers le haut, en évitant qu'ils se
// chevauchent quelle que soit la taille d'écran. Ordre des enfants en
// JSX = ordre visuel du bas vers le haut (flex-col-reverse).
export default function MapActionStack({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute bottom-20 right-4 z-20 flex flex-col-reverse items-end gap-2 md:bottom-3">
      {children}
    </div>
  );
}
