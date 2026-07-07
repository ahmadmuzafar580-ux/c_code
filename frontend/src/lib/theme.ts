/**
 * Famrak design tokens - derived from design_guidelines.json
 */
export const colors = {
  surface: "#F7F7F6",
  onSurface: "#1C1C1E",
  surfaceSecondary: "#FFFFFF",
  onSurfaceSecondary: "#3A3A3C",
  surfaceTertiary: "#EFEFEF",
  onSurfaceTertiary: "#636366",
  surfaceInverse: "#1C1C1E",
  onSurfaceInverse: "#FFFFFF",
  brand: "#3A6047",
  brandPrimary: "#3A6047",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#84A590",
  onBrandSecondary: "#1C1C1E",
  brandTertiary: "#E2ECE5",
  onBrandTertiary: "#23402E",
  success: "#427A5B",
  onSuccess: "#FFFFFF",
  warning: "#D48C29",
  onWarning: "#1C1C1E",
  error: "#C75043",
  onError: "#FFFFFF",
  info: "#636366",
  border: "#E5E5EA",
  borderStrong: "#C7C7CC",
  divider: "#E5E5EA",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  "2xl": 32,
  "3xl": 48,
} as const;

export const radius = {
  sm: 6,
  md: 12,
  lg: 20,
  pill: 999,
} as const;

export const type = {
  sm: 12,
  base: 14,
  lg: 16,
  xl: 20,
  "2xl": 24,
} as const;

export const shadow = {
  card: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  soft: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
};

export const avatars = {
  mom: "https://images.unsplash.com/photo-1570657891791-e39a9d185540?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NzR8MHwxfHNlYXJjaHwxfHxwb3J0cmFpdCUyMHNtaWxpbmclMjBtb3RoZXIlMjBwaG90b3xlbnwwfHx8fDE3ODM0MDc4NjJ8MA&ixlib=rb-4.1.0&q=85",
  boy: "https://images.unsplash.com/photo-1547222220-069507723741?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzR8MHwxfHNlYXJjaHwxfHxwb3J0cmFpdCUyMHRlZW5hZ2UlMjBib3klMjBzbWlsaW5nJTIwcGhvdG98ZW58MHx8fHwxNzgzNDA3ODYyfDA&ixlib=rb-4.1.0&q=85",
  dad: "https://images.unsplash.com/photo-1564156280315-1d42b4651629?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2NDJ8MHwxfHNlYXJjaHwxfHxwb3J0cmFpdCUyMHNtaWxpbmclMjBmYXRoZXIlMjBwaG90b3xlbnwwfHx8fDE3ODM0MDc4NjJ8MA&ixlib=rb-4.1.0&q=85",
};

export const images = {
  onboardingFamily:
    "https://images.unsplash.com/photo-1561049527-9743861dce35?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NzB8MHwxfHNlYXJjaHwxfHxmYW1pbHklMjB3YWxraW5nJTIwaW4lMjBwYXJrJTIwc3VubnklMjBkYXl8ZW58MHx8fHwxNzgzNDA3ODY5fDA&ixlib=rb-4.1.0&q=85",
  placeHome:
    "https://images.pexels.com/photos/323780/pexels-photo-323780.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
  placeSchool:
    "https://images.pexels.com/photos/17144608/pexels-photo-17144608.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
  emptyHistory:
    "https://images.pexels.com/photos/12961119/pexels-photo-12961119.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
};

/** Deterministic avatar assignment per user id. */
export function avatarForUser(userId: string): string {
  const list = [avatars.mom, avatars.dad, avatars.boy];
  let sum = 0;
  for (let i = 0; i < userId.length; i++) sum += userId.charCodeAt(i);
  return list[sum % list.length];
}
