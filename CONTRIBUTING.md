# Contributing

Thanks for your interest in contributing. This repository is a demo and proprietary; open external contributions may be limited. For internal contributors:

## Scripts
| Command | Purpose |
|--------:|---------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Production build |
| `npm run preview` | Serve local production build |

## Code Style
- TypeScript, functional React components.
- Prefer descriptive names and early returns.
- Keep comments concise and only where non‑obvious.

## Linting & Formatting
- Ensure TypeScript compiles without errors.
- Maintain consistent formatting; match existing style.

## Testing
- Manual verification: page loads, charts render, tooltips show `date → value → Average`.
- Validate parameter modals: custom period labels, min/max single‑bound defaults.

## Commit Messages
- Conventional style recommended:
  - `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`, `perf:`

## Pull Request Policy
- Link to the change scope and screenshots for UI changes.
- Keep PRs focused and small when possible.
- Ensure docs updated when behavior or conventions change.

## Release Process
- Bump version in `package.json` (SemVer) and update `CHANGELOG.md`.
- Commit with message `chore(release): vX.Y.Z` and a bullet summary.
- Tag the commit `vX.Y.Z` and push both main and the tag.
- Ensure `PROJECT_OVERVIEW.md` and docs reflect updated behavior (CSV formats, Données page, SQL integration).
