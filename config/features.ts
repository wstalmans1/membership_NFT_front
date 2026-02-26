// Build variant feature flags
// Controlled by NEXT_PUBLIC_BUILD_VARIANT at build time.
//   full        → complete DApp (default)
//   community   → membership + community pages only, no voting power

const variant = process.env.NEXT_PUBLIC_BUILD_VARIANT ?? 'full';

export const isCommunityOnly = variant === 'community';

export const features = {
  // Navigation
  showNavbar: !isCommunityOnly,

  // Pages
  showDashboard: !isCommunityOnly,
  showCommunity: true,              // visible in both builds
  showGovernance: !isCommunityOnly,
  showTreasury: !isCommunityOnly,
  showConstitution: !isCommunityOnly,
  showMorePages: !isCommunityOnly, // dao-architecture, philosophy, trilemma, getting-started

  // Membership page sections
  showVotingPower: !isCommunityOnly,
} as const;

// Version switch — links to the other deployed build
export const versionSwitch = isCommunityOnly
  ? { label: 'Extended DAO', href: 'https://qawldao.eth.limo/' }
  : { label: 'Community Portal', href: 'https://community.qawldao.eth.limo/community/' };
