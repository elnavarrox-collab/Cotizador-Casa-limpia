export const APP_TABS = ["quote", "memberships", "history", "settings"] as const;
export type AppTab = (typeof APP_TABS)[number];

export function parseTabHash(hash: string): AppTab {
  const candidate = hash.replace(/^#/, "");
  return APP_TABS.includes(candidate as AppTab) ? candidate as AppTab : "quote";
}
