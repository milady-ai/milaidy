#!/usr/bin/env node
/**
 * Creates a symlink from the installed @elizaos/plugin-browser's expected
 * `dist/server` directory to the workspace's stagehand-server source.
 *
 * The npm package doesn't include the compiled browser server, so we link
 * it from the workspace at `plugins/plugin-browser/stagehand-server/`.
 *
 * Run automatically via the `postinstall` hook, or manually:
 *   node scripts/link-browser-server.mjs
 */
import { existsSync, symlinkSync, readlinkSync, unlinkSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const milaidyRoot = resolve(__dirname, "..");
const workspaceRoot = resolve(milaidyRoot, "..");

// Where the stagehand-server lives in the workspace
const stagehandDir = join(
  workspaceRoot,
  "plugins",
  "plugin-browser",
  "stagehand-server",
);
const stagehandIndex = join(stagehandDir, "dist", "index.js");

if (!existsSync(stagehandIndex)) {
  console.log(
    `[link-browser-server] Stagehand server not found at ${stagehandDir} — skipping`,
  );
  process.exit(0);
}

// Resolve the plugin-browser package location
let pluginRoot;
try {
  const req = createRequire(join(milaidyRoot, "package.json"));
  const pkgJson = req.resolve("@elizaos/plugin-browser/package.json");
  pluginRoot = dirname(pkgJson);
} catch {
  console.log(
    "[link-browser-server] @elizaos/plugin-browser not installed — skipping",
  );
  process.exit(0);
}

const serverLink = join(pluginRoot, "dist", "server");

// Already correctly linked
if (existsSync(serverLink)) {
  try {
    const target = readlinkSync(serverLink);
    if (target === stagehandDir) {
      console.log("[link-browser-server] Symlink already up to date");
      process.exit(0);
    }
    // Stale symlink — remove and recreate
    unlinkSync(serverLink);
  } catch {
    // Not a symlink (real directory) — leave it alone
    console.log(
      "[link-browser-server] dist/server already exists as a directory — skipping",
    );
    process.exit(0);
  }
}

try {
  symlinkSync(stagehandDir, serverLink, "dir");
  console.log(
    `[link-browser-server] Linked: ${serverLink} -> ${stagehandDir}`,
  );
} catch (err) {
  console.error(`[link-browser-server] Failed to create symlink: ${err}`);
  process.exit(1);
}
