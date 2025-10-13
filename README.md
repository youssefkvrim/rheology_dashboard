## Démo Suivi des Barbotines

Projet de démonstration front-only (Vite + React + TypeScript) pour illustrer un suivi simple de barbotines avec données factices, sans backend.

### Fonctionnalités
- Accueil avec 10 cartes (M7 en ligne, 9 hors-ligne), dernière mesure et statut.
- Détail M7 avec 4 graphiques temps quasi réel (Recharts): densité, viscosité, pH, température.
- Panneau « pouvoir couvrant »: génération d'une courbe masse(t) 30s et affichage d'une image factice.
- Recommandation triviale basée sur la viscosité, bouton override avec journal local (non persistant).
- Page Alertes listant les dépassements + Importer CSV (parse et trace des points, sans sauvegarde).
- Rafraîchissement des données toutes les 5 secondes, générateur aléatoire seedable via `?seed=123`.

### Lancer la démo
```bash
npm install
npm run dev
```
Ouvrez le navigateur sur l'URL affichée (par défaut `http://localhost:5173`).

Pour construire:
```bash
npm run build && npm run preview
```

### Notes techniques
- Global state léger via `AppStateProvider` (`src/store/appState.tsx`).
- Recharts pour les graphiques, React Router pour la navigation.
- Styles CSS minimalistes dans `src/app.css`.
- Aucune écriture disque, aucune auth, données générées côté client.


