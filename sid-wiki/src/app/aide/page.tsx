import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import Icon, { type IconName } from '@/components/Icon';

export const dynamic = 'force-dynamic';

type Step = { icon: IconName; title: string; text: React.ReactNode };

function Steps({ steps }: { steps: Step[] }) {
  return (
    <ol className="grid gap-3 sm:grid-cols-2">
      {steps.map((s, i) => (
        <li key={s.title} className="card flex gap-3 p-4">
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-brass-400 font-typewriter text-lg font-extrabold text-night">{i + 1}</span>
          <div className="min-w-0">
            <h3 className="font-bold"><Icon name={s.icon} className="mr-1" /> {s.title}</h3>
            <p className="mt-1 text-sm text-olive-800">{s.text}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

const code = 'rounded bg-white/10 px-1.5 py-0.5 font-typewriter text-xs';

export default async function HelpPage() {
  const { data: isAdmin } = await createClient().rpc('wiki_is_admin');

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="title-grad mb-1 font-typewriter text-2xl font-bold text-olive-800 sm:text-3xl">
        <Icon name="aide" /> Mini-guide du wiki
      </h1>
      <p className="mb-6 text-olive-700">Tout ce qu’il faut savoir en une minute.</p>

      <h2 className="mb-3 font-typewriter text-xl font-bold text-olive-800">Pour les chasseurs</h2>
      <Steps
        steps={[
          {
            icon: 'lieux',
            title: 'Explore les catégories',
            text: (
              <>
                Lieux, Armes, Mobs, Objets et Skills. Chaque fiche a un numéro (000 à 999). Une fiche affichée <strong>« ? »</strong> n’a pas encore été découverte : elle apparaîtra quand la S.I.D. la croisera en chasse !
              </>
            ),
          },
          {
            icon: 'chercher',
            title: 'Cherche ce que tu veux',
            text: (
              <>
                La barre de recherche trouve les noms, tags, numéros et textes. Sur ordinateur, appuie sur <span className={code}>/</span> pour y aller direct.
              </>
            ),
          },
          {
            icon: 'mobs',
            title: 'Lis une fiche',
            text: 'Survole (ou touche) un lien pour un aperçu rapide. Sur les skills, glisse sur le modèle 3D pour le faire tourner. Le sommaire t’aide à sauter à une section.',
          },
          {
            icon: 'favoris',
            title: 'Fais-en ton wiki',
            text: '☆ Favori pour retrouver une fiche, 📝 Mes notes pour tes astuces (privées), 💬 les commentaires pour échanger avec les autres chasseurs.',
          },
          {
            icon: 'aide',
            title: 'Une erreur ? Une idée ?',
            text: 'En bas de chaque fiche, « 🚩 Signaler un problème » envoie un message aux admins.',
          },
          {
            icon: 'menu',
            title: 'Confort',
            text: (
              <>
                Le bouton <strong>⋯</strong> d’une fiche permet de partager, d’imprimer et de changer la taille du texte. Sur téléphone, ajoute le wiki à ton écran d’accueil (iPhone : Partager → « Sur l’écran d’accueil »).
              </>
            ),
          },
        ]}
      />

      {isAdmin === true && (
        <>
          <h2 className="mb-3 mt-10 font-typewriter text-xl font-bold text-olive-800">Pour les admins</h2>
          <Steps
            steps={[
              {
                icon: 'admin',
                title: 'Créer une fiche',
                text: (
                  <>
                    Menu → Dashboard admin → <strong>+ Nouvelle fiche</strong>. Le numéro libre est proposé. Une fiche reste masquée (« ? ») tant que « Découverte » n’est pas coché.
                  </>
                ),
              },
              {
                icon: 'objets',
                title: 'Écrire en Markdown',
                text: (
                  <>
                    <span className={code}>## Titre</span> crée une section, <span className={code}>**gras**</span>, <span className={code}>[[armes/012]]</span> ou <span className={code}>[[armes/012|texte]]</span> lie une autre fiche, <span className={code}>@pseudo</span> mentionne un chasseur. L’aperçu s’affiche à côté.
                  </>
                ),
              },
              {
                icon: 'skills',
                title: 'Ajouter un modèle 3D',
                text: 'Envoie un .glb ou un .fbx, choisis l’animation à garder : le site supprime les autres et allège le fichier. Les shaders Blender personnalisés doivent être « bakés » en texture avant l’export.',
              },
              {
                icon: 'favoris',
                title: 'Découvrir et créditer',
                text: 'Bouton Découvrir / Masquer dans la liste (ou en masse via la sélection). Le champ « Découvert par » crédite un chasseur et alimente le classement.',
              },
              {
                icon: 'tags',
                title: 'Garder le wiki propre',
                text: 'Le filtre « À compléter » liste les fiches incomplètes. Onglet Signalements : traite les messages des membres. Tags en masse, duplication, import / export JSON : tout est dans le Dashboard.',
              },
              {
                icon: 'accueil',
                title: 'Parler à tout le monde',
                text: 'Dashboard → Réglages : publie une annonce affichée en haut de l’accueil.',
              },
            ]}
          />
          <p className="mt-3 text-sm text-olive-700">
            Besoin de personnaliser les icônes ? Voir <span className={code}>public/icons/LISEZ-MOI.txt</span>.
          </p>
        </>
      )}

      <div className="mt-8 text-center">
        <Link href="/" className="btn">
          C’est parti !
        </Link>
      </div>
    </div>
  );
}
