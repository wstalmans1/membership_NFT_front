// Build variant feature flags
// Controlled by NEXT_PUBLIC_BUILD_VARIANT at build time.
//   full        → complete DApp (default)
//   membership  → membership + community pages only, no voting power

const variant = process.env.NEXT_PUBLIC_BUILD_VARIANT ?? 'full';

export const isMembershipOnly = variant === 'membership';

export const features = {
  // Navigation
  showNavbar: !isMembershipOnly,

  // Pages
  showDashboard: !isMembershipOnly,
  showCommunity: true,              // visible in both builds
  showGovernance: !isMembershipOnly,
  showTreasury: !isMembershipOnly,
  showConstitution: !isMembershipOnly,
  showMorePages: !isMembershipOnly, // dao-architecture, philosophy, trilemma, getting-started

  // Membership page sections
  showVotingPower: !isMembershipOnly,
} as const;
