/**
 * Navigation — tabs + onboarding.
 */

export type Tab = "chat" | "apps" | "game" | "inventory" | "plugins" | "skills" | "database" | "config" | "logs";

export const TAB_GROUPS = [
  { label: "Chat", tabs: ["chat"] as Tab[] },
  { label: "Play", tabs: ["apps"] as Tab[] },
  { label: "Manage", tabs: ["inventory", "plugins", "skills", "database"] as Tab[] },
  { label: "Settings", tabs: ["config", "logs"] as Tab[] },
] as const;

const TAB_PATHS: Record<Tab, string> = {
  chat: "/chat",
  apps: "/apps",
  game: "/game",
  inventory: "/inventory",
  plugins: "/plugins",
  skills: "/skills",
  database: "/database",
  config: "/config",
  logs: "/logs",
};

const PATH_TO_TAB = new Map(
  Object.entries(TAB_PATHS).map(([tab, p]) => [p, tab as Tab]),
);

export function pathForTab(tab: Tab, basePath = ""): string {
  const base = normalizeBasePath(basePath);
  const p = TAB_PATHS[tab];
  return base ? `${base}${p}` : p;
}

export function tabFromPath(pathname: string, basePath = ""): Tab | null {
  const base = normalizeBasePath(basePath);
  let p = pathname || "/";
  if (base) {
    if (p === base) p = "/";
    else if (p.startsWith(`${base}/`)) p = p.slice(base.length);
  }
  let normalized = normalizePath(p).toLowerCase();
  if (normalized.endsWith("/index.html")) normalized = "/";
  if (normalized === "/") return "chat";
  return PATH_TO_TAB.get(normalized) ?? null;
}

export function normalizeBasePath(basePath: string): string {
  if (!basePath) return "";
  let base = basePath.trim();
  if (!base.startsWith("/")) base = `/${base}`;
  if (base === "/") return "";
  if (base.endsWith("/")) base = base.slice(0, -1);
  return base;
}

export function normalizePath(p: string): string {
  if (!p) return "/";
  let normalized = p.trim();
  if (!normalized.startsWith("/")) normalized = `/${normalized}`;
  if (normalized.length > 1 && normalized.endsWith("/")) normalized = normalized.slice(0, -1);
  return normalized;
}

export function titleForTab(tab: Tab): string {
  switch (tab) {
    case "chat": return "Chat";
    case "apps": return "Apps";
    case "game": return "Game";
    case "inventory": return "Inventory";
    case "plugins": return "Plugins";
    case "skills": return "Skills";
    case "database": return "Database";
    case "config": return "Config";
    case "logs": return "Logs";
    default: return "Milaidy";
  }
}

export function subtitleForTab(tab: Tab): string {
  switch (tab) {
    case "chat": return "";
    case "apps": return "";
    case "game": return "";
    case "inventory": return "Tokens and NFTs across all wallets.";
    case "plugins": return "";
    case "skills": return "";
    case "database": return "";
    case "config": return "";
    case "logs": return "";
    default: return "";
  }
}
