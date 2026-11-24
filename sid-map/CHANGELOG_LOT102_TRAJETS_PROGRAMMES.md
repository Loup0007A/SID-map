# Lot 102 : trajets programmés

Migration : `0123_trajets_programmes.sql`, à lancer après les migrations
0131 et 0132 du site central (même base). Rejouable.

## Dans Itinéraire

- **Routes une à une** : « Choisir les routes une à une » reprend le plus
  court chemin, puis on ajoute la route suivante depuis la dernière étape,
  on retire la dernière, ou on complète jusqu'à l'arrivée.
- **Pauses** : « + pause ici » à chaque étape intermédiaire, de 1 minute à
  24 heures, 20 au plus. Le personnage attend sur place, puis repart seul.
- **Vol direct** avec une monture volante équipée.
- **Quand** : maintenant, « Partir à » (heure de départ à la seconde) ou
  « Arriver à » (le départ est calculé pour arriver à l'heure voulue).
  L'estimation vient du serveur ; la météo est appliquée au moment du départ.
- **Mes trajets programmés** : à venir, partis, annulés ou pas partis (7
  derniers jours), avec annulation.

## Règles

- 10 trajets programmés au plus, 60 jours à l'avance au plus, sans
  chevauchement. Le départ est pris à l'heure exacte (le trajet est daté de
  la seconde prévue, même si la vérification passe un peu après).
- Le point de départ est l'endroit où le personnage sera à cette heure
  (après ses autres trajets programmés).
- Encore en route à l'heure dite : départ à l'arrivée exacte, 6 heures
  d'attente au plus. Pas au bon endroit : le trajet ne part pas et une
  notification l'explique.
- Pendant une pause, le bandeau de voyage affiche « En pause à … jusqu'à
  HH:MM:SS ».
