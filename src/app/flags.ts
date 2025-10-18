// Lightweight feature flags for incremental rollouts.
// Do not import React here; keep it tree-shakeable and side-effect free.

export type Flags = {
  useRepositoryFlows: boolean; // Toggle future API/SQL repo usage in pages
  lazyRoutes: boolean;         // Toggle React.lazy route code-splitting (future)
  newDetailPanels: boolean;    // Toggle refactored Detail panels (future)
};

export const flags: Flags = {
  useRepositoryFlows: false,
  lazyRoutes: false,
  newDetailPanels: false,
};


