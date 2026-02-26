import { useViewMode } from '@/contexts/ViewModeContext';

/**
 * Returns reactive feature flags driven by the current view mode.
 * Community mode → hides DAO-specific pages/sections.
 * Extended mode  → shows everything.
 *
 * For the community build (`NEXT_PUBLIC_BUILD_VARIANT=community`) the mode is
 * always 'community' (locked at build time via ViewModeContext).
 */
export function useFeatures() {
  const { isExtended } = useViewMode();

  return {
    showNavbar: true,            // navbar always visible; mode controls its content
    showDashboard: isExtended,
    showCommunity: true,         // always visible
    showGovernance: isExtended,
    showTreasury: isExtended,
    showConstitution: isExtended,
    showMorePages: isExtended,
    showVotingPower: isExtended,
  } as const;
}
