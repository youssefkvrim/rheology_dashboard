// Feature flags for progressive rollout. Read-only at runtime; toggle via builds/env.
// Keep flags minimal and centralized. Use for gating new flows while refactoring.

export type FeatureFlags = {
  // Route-level code-splitting and lazy routes
  enableRouteCodeSplitting: boolean;
  // Use repository seam (async data access) instead of direct store selectors
  enableRepositorySeam: boolean;
  // New Detail panels extracted as components
  enableComponentizedDetailPanels: boolean;
};

// Default flags. In production, override via Vite env vars (VITE_FLAG_*) at build time if needed.
export const flags: FeatureFlags = {
  enableRouteCodeSplitting: true,
  enableRepositorySeam: false,
  enableComponentizedDetailPanels: false,
};

// Optional helpers for env-driven overrides (opt-in; avoids eagerly reading env in all call sites)
export function withEnvOverrides(base: FeatureFlags = flags): FeatureFlags {
  const readBool = (key: string, fallback: boolean) => {
    const v = (import.meta as any)?.env?.[key];
    if (v == null) return fallback;
    const s = String(v).toLowerCase();
    return s === '1' || s === 'true' || s === 'yes';
  };
  return {
    enableRouteCodeSplitting: readBool('VITE_FLAG_ROUTE_SPLIT', base.enableRouteCodeSplitting),
    enableRepositorySeam: readBool('VITE_FLAG_REPO_SEAM', base.enableRepositorySeam),
    enableComponentizedDetailPanels: readBool('VITE_FLAG_DETAIL_COMPONENTS', base.enableComponentizedDetailPanels),
  };
}


