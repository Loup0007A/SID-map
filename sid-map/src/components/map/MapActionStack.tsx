'use client';

// Empile les boutons/pop-ups flottants du coin bas-droit (légende,
// présences, "ma position") du bas vers le haut, en évitant qu'ils se
// chevauchent quelle que soit la taille d'écran. Ordre des enfants en
// JSX = ordre visuel du bas vers le haut (flex-col-reverse).
// `raised` : sur téléphone, la barre d'édition dépliée occupe deux lignes
// en bas de l'écran ; on remonte la pile pour ne pas la recouvrir.
export default function MapActionStack({ children, raised = false }: { children: React.ReactNode; raised?: boolean }) {
  return (
    <div className={`absolute right-4 z-20 flex flex-col-reverse items-end gap-2 md:bottom-3 ${raised ? 'bottom-36' : 'bottom-20'}`}>
      {children}
    </div>
  );
}
