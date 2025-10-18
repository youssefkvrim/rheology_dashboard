## Suivi des Barbotines — Front-End (Vite + React + TypeScript)

Application front-only démontrant un tableau de bord de suivi de barbotines (données simulées, sans backend) avec graphiques Recharts, navigation React Router, et état global léger.

### Sommaire
- Fonctionnalités clés
- Démarrage rapide et scripts
- Architecture et structure du projet
- Données et flux (simulation, rafraîchissement, bornes)
- Pages et comportements UX principaux
- Graphiques: conventions unifiées (tooltips, moyenne, zones critiques, période personnalisée)
- Thème, accessibilité, i18n
- Limitations et pistes d’évolution

---

### Fonctionnalités clés
- Accueil: cartes barbotines (état en ligne/hors-ligne), dernières valeurs, badges de statut; cartes Ambiant (Température/Humidité) avec mini-graphes.
- Détail: graphiques temps quasi réel Densité, Viscosité, Température, pH; historique Pouvoir couvrant; essai Masse; Débit H₂O; panneaux additionnels Silice et Grains (axes vides, prêt à alimenter).
- Paramétrage par graphe via une modale unifiée « Paramètres »: Période personnalisée (Début/Fin), Conformité min/max, Unité, Moyenne, Zones critiques (%).
- Alertes: table des dépassements et import CSV simple (tracé en nuage de points, temporaire).
- Rafraîchissement périodique (5s) et générateur déterministe seedable via `?seed=123`.

---

### Démarrage rapide
Prérequis: Node 18+ recommandé.

```bash
npm install
npm run dev
```
Ouvrez `http://localhost:5173`.

Build et prévisualisation statique:
```bash
npm run build && npm run preview
```

Scripts utiles:
- `dev`: lance Vite en mode développement
- `build`: build de production
- `preview`: sert le build localement

---

### Architecture et structure du projet

Technos: Vite, React, TypeScript, React Router, Recharts. Styles CSS simples (variables CSS pour thème clair/sombre) dans `src/app.css`.

Arborescence (extrait):
```
src/
  App.tsx                # Shell, nav, thème, routing, auth minimale
  app.css                # Styles globaux, composants, modales, thème
  main.tsx               # Entrée Vite + Router + AppStateProvider
  pages/
    Home.tsx             # Accueil: cartes barbotines + Ambiant
    Detail.tsx           # Détail barbotine: graphiques et paramètres unifiés
    Alerts.tsx           # Alertes + import CSV (ScatterChart)
    Donnees.tsx          # Données (placeholder/affichage table)
    Params.tsx           # Paramètres (page dédiée)
    Login.tsx            # Auth minimale (front-only)
  store/
    appState.tsx         # État global, générateurs, sélecteurs
public/                  # Icônes, images
```

Voir `PROJECT_OVERVIEW.md` pour la carte détaillée des responsabilités (source de vérité projet).

---

### Données et flux
- Simulation déterministe (Mulberry32) initialisée par `?seed=<nombre>`.
- `AppStateProvider` gère:
  - Séries métriques (densité, viscosité, pH, température)
  - Historique ambiant (température/humidité)
  - Débit H₂O (historique), Pouvoir couvrant (historique)
  - Bornes (min/max) par métrique, persistées en `localStorage`
  - Rafraîchissement toutes les 5s (si live actif)
- Sélecteurs séries:
  - `getSeriesForRange(range, anchorTs)` pour fenêtres glissantes standard
  - `getSeriesBetween(start, end)` pour période personnalisée (Début/Fin)

---

### Pages & UX
- Accueil (`Home.tsx`)
  - Cartes Ambiant (Température: Y [15,30], Humidité: Y [45,75]) avec X en `DD/MM`. Pas de courbe moyenne. Cartes alignées en grille comme les barbotines.
  - Cartes barbotines: badges OK/Critical/Warning, dernière valeur par métrique, tendance H₂O (icône à droite), pastille bleue à gauche.
- Détail (`Detail.tsx`)
  - Graphiques Recharts avec pan horizontal, ajustement vertical, tooltips unifiés (ordre: date, Valeur, Average).
  - Modale « Paramètres » unifiée pour tous les graphes: Période personnalisée (Début/Fin avec validation), Conformité min/max (saisie unique autorisée: min=>0, max=>999), Unité, Moyenne (ligne pointillée), Zones critiques (%).
  - Images: ouverture dans un nouvel onglet + aperçu modal fermable par clic extérieur.
  - Panneaux Silice (%) et Grains (%) présents (axes seulement, à alimenter).
- Alertes (`Alerts.tsx`)
  - Tableau des dépassements basé sur les bornes actives; import CSV (timestamp,value) et tracé type Scatter.

---

### Graphiques — conventions unifiées
- Librairie: Recharts (`LineChart`, `ScatterChart`).
- Tooltips: affichent `date`, puis `Valeur`, puis `Average` (si la moyenne est activée). Les libellés sont explicites (p.ex. « Température », « Débit H₂O », etc.).
- Moyenne: rendue en ligne pointillée rouge, activable par graphe.
- Zones critiques: plages colorées selon pourcentage autour des bornes.
- Périodes: 3H / 1D / 7D / 1M / 3M / ALL + Période personnalisée (Début/Fin).

---

### Thème, accessibilité, i18n
- Thème clair/sombre via attribut `data-theme` (persisté localement).
- Icônes SVG et palette sobre; contrastes soignés.
- Formatages locaux (dates `fr-FR` côté Accueil). i18n non-industrialisée (libre à intégrer).

---

### Limitations
- Données simulées (pas de backend ni persistance serveur). Certaines pages sont des gabarits (ex. `Donnees.tsx`).
- Auth front-only (statut en mémoire).
- Import CSV non persisté.

---

### Contribution
- TypeScript strict conseillé, suivre les conventions de code en place.
- Pour ajouter un nouveau graphe (ex: nouvelle métrique):
  1) Ajouter la métrique au store (`MetricsSeries`, générateurs, bornes par défaut)
  2) Déclarer la source et la série (avec `avg`) dans `Detail.tsx`
  3) Reutiliser la modale `Paramètres` unifiée (mêmes options)
  4) Respecter l’ordre `Valeur` puis `Average` et les libellés/units

Voir `PROJECT_OVERVIEW.md` pour la carte détaillée et les points d’extension.