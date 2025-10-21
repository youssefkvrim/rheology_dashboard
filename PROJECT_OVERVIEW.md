# PROJECT_OVERVIEW

Authoritative technical documentation. Single source of truth for architecture, state, routing, and chart conventions.

## Mini Table of Contents
- [1. Vision](#1-vision)
- [2. Tech Stack](#2-tech-stack)
- [3. High-Level Structure](#3-high-level-structure)
- [4. Routing](#4-routing)
- [5. State Management](#5-state-management-srcstoreappstatetsx)
  - [Data Simulation](#data-simulation)
  - [Bounds and Validation Policies](#bounds-and-validation-policies)
  - [Locale & Time Policy](#locale--time-policy)
- [6. UI Shell](#6-ui-shell-srcapptsx)
- [7. Pages](#7-pages)
- [8. Charts Conventions](#8-charts-conventions)
- [9. Styling](#9-styling-srcappcss)
- [10. Extensibility](#10-extensibility)
- [11. Known Limitations](#11-known-limitations)
- [12. Developer Notes](#12-developer-notes)
- [Appendix: CSV Import](#appendix-csv-import)

## 1. Vision
Front-only dashboard to supervise barbotines. Focused on clarity, fast iteration, and consistent UX across charts. Data is simulated deterministically, enabling demos without backend.

## 2. Tech Stack
- Vite + React + TypeScript
- React Router (navigation)
- Recharts (charts)
- CSS variables (themes), minimal custom CSS in `src/app.css`

## 3. High-Level Structure
```
src/
  main.tsx            // App bootstrap: React.StrictMode, BrowserRouter, AppStateProvider
  app/                // App shell and runtime flags
    App.tsx           // nav, theme toggle, routing, footer
    flags.ts          // feature flags for progressive rollout
  components/         // Shared UI building blocks (ParamsModal, MetricPanel, ...)
  features/           // Future feature modules (barbotine, ambient, auth)
  repositories/       // Data access abstractions (MetricsRepository)
    metricsRepo.ts    // interface + SimMetricsRepository wrapping simulation
  services/           // External service clients (API/SQL placeholders)
    api.ts            // placeholder HTTP client
  store/
    appState.tsx      // Global state, data simulation, selectors/utilities, repo context
  types/
    domain.ts         // Centralized domain models
  app.css             // Global styles: layout, components, modal, charts, theme
public/               // Static assets (SVG icons, images)
```

## 4. Routing
- Defined in `App.tsx`:
  - `/` → `Home`
  - `/barbotine/:id` → `Detail`
  - `/donnees` → `Donnees`
  - `/params` → `Params`

## 5. State Management (`src/store/appState.tsx`)
- Context: `AppStateProvider`, accessed with `useAppState()`.
- Types:
  - Domain models centralized in `types/domain.ts`: `MetricSample`, `MetricsSeries`, `Barbotine`, `Bounds`, `MetricKey`, `RangeKey`.
- AppState surface:
  - `seriesM7`: metrics series (simulated), updated every 5s when `live` is true
  - `bounds`: default min/max per metric; persisted in `localStorage`
  - `ambient`, `ambientHistory`: room temperature (%) and humidity (%)
  - `doseRateLph`, `doseRateHistory`: H₂O dosing rate (current + history)
  - `coverPowerHistory`: historical covering power (g)
  - `barbotines`: list of barbotines; one online (`M7-3 006`) as demo
  - Actions: `setBounds`, `addManualSample`, `startMassTest`, `addOverride`, `applyMetricPoints`, etc.
  - Selectors: `getSeriesForRange(range, anchor)`, `getSeriesBetween(start, end)`
  - Repository seam: `repo` exposed on context implements `MetricsRepository` (simulated by default)

### Data Simulation
### Bounds and Validation Policies
- Bounds (`low`/`high`) are nullable; comparisons handle missing sides.
- Decimal inputs accept both comma and dot as separator in UI.
- UI parameter modal allows entering only `min` or only `max`:
  - Only `min` → `max` virtually defaults to `999.999` (not displayed)
  - Only `max` → `min` virtually defaults to `0` (not displayed)
- Charts shade ranges using virtual defaults; storage keeps only user-provided sides.
- Alerts compute ≥/≤ checks accordingly; ranges are rendered as `≤X`, `≥Y`, or `Y–X`.

### Locale & Time Policy
- UI charts use browser local time; `Home` mini-charts format day/month as `DD/MM`.
- 24‑hour time format for tooltips; timezone = client system timezone; DST behavior inherits browser `Date`.
- CSV import accepts numeric epoch or ISO strings, parsed by `Date.parse`.
- Mulberry32 seeded via `?seed=` for deterministic series.
- Live tick (5s) updates series and ambient; H₂O history is extended and windowed.

## 6. UI Shell (`src/App.tsx`)
- Theme toggle (light/dark) persisted in `localStorage`.
- Brand (Safran) navigates to `/` using router link.
- Auth front-only: a simple `authed` gate toggled by `Login`.
- Footer informative line (no top border).

## 7. Pages

### Home (`src/pages/Home.tsx`)
- Grid of cards:
  - Ambient: Température salle (Y [15,30]) et Humidité salle (Y [45,75]); X en `DD/MM`; pas de moyenne.
  - Barbotines: pastille à gauche, libellés et badges à droite, flèche tendance H₂O à droite.
- Navigation to detail when a barbotine is clickable.

### Detail (`src/pages/Detail.tsx`)
- Charts: Densité, Viscosité, Température, pH, Pouvoir couvrant (historique), Essai Masse, Débit H₂O, Silice (%), Grains (%).
- Interactions:
  - Pan horizontal par drag (layer transparent), ajustement vertical par drag.
  - Tooltips unifiés: `date`, `Valeur`, `Average`.
  - Moyenne: ligne pointillée rouge, activable.
  - Zones critiques: plages colorées réglées par pourcentage (crit %) autour des bornes.
  - Périodes: 3H/1D/7D/1M/3M/ALL + Période personnalisée (Début/Fin, validation Fin > Début).
- Paramètres unifiés (fonction `renderParamsModal`):
  - Période personnalisée (Début/Fin)
  - Conformité min/max avec saisie unique possible (si min seul → max=999 ; si max seul → min=0)
  - Unité (affichage tooltip)
  - Moyenne (toggle)
  - Zones critiques (%) (toggle + slider)
- Images:
  - Aperçu modal fermable par clic extérieur + lien « Ouvrir dans un nouvel onglet ».

### Alerts (`src/pages/Alerts.tsx`)
- Liste d’alertes déterminée par `bounds` (supporte bornes nulles, ≥/≤ si borne unique).
- Import CSV (format `timestamp,value` ou `ISO,value`) → scatter.

## 8. Charts Conventions
- Libraries: Recharts (`LineChart`, `ScatterChart`).
- Order: render primary value series before average; tooltips: (date, value, Average).
- Average series: dashed red line, isAnimationActive=false.
- Axis X: time scale; `Home` ambient mini-charts format `DD/MM`.
 - Tooltip behavior (MetricPanel): tooltip anchors to the nearest primary data point to the hovered X, then classifies the current trend segment (Haussière/Baissière/Horizontale). Trend line does not interfere with hover selection.
 - Error bars (MetricPanel): when `deltaY` is set, one error bar is rendered per vertical grid line (aligned with X ticks). The Y position for each error bar is the value of the primary series at the closest data point to the tick.

## 9. Styling (`src/app.css`)
- CSS vars for `--bg`, `--panel`, `--border`, `--muted`, `--text`, `--accent`, `--grid`.
- Layout classes: `.grid`, `.row`, `.panel`, `.card`, `.badge`, `.chart`, `.segmented`.
- Modal: `.modal-backdrop`, `.modal`, `.modal-header`, `.modal-body`.
- Switches: `.switch`, `.glass-switch` variants.

## 10. Extensibility
- New metric:
  1) Add to `MetricsSeries`, default bounds in provider, and generators
  2) In `Detail.tsx`, map source → series (`value` + computed `avg`)
  3) Reuse `renderParamsModal` with unit/avg/crit/bounds configuration
  4) Follow ordering and tooltip conventions

## 10.5 Data Layer (Repositories)
- `repositories/metricsRepo.ts` defines `MetricsRepository` to abstract data sources.
- Default `SimMetricsRepository` wraps existing simulation selectors.
- Future `ApiMetricsRepository` (via `services/api.ts`) will call SQL-backed endpoints.

## 11. Known Limitations
- Data is simulated (no backend). Auth is in-memory.
- Import CSV is non-persistent.
- Silice/Grains panels show axes only until real data is wired.

## 12. Developer Notes
- Keep primary series first, average second to avoid tooltip duplication.
- Always validate custom periods; guard against `Fin <= Début`.
- For single-bound inputs, auto-complete missing bound (min→0, max→999) to keep zones meaningful.
## Appendix: CSV Import
See [docs/CSV.md](docs/CSV.md) for the complete format and validation rules.

