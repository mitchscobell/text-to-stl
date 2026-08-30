#!/usr/bin/env node
/**
 * scripts/release-body.mjs
 *
 * Prints the markdown body for one release, from data/release-notes.json —
 * or its headline with --title.
 *
 * Usage: node scripts/release-body.mjs 0.1.0
 *        node scripts/release-body.mjs 0.1.0 --title
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const wanted = (process.argv[2] ?? "").replace(/^v/, "");
const wantTitle = process.argv.includes("--title");

const releases = JSON.parse(readFileSync(join(ROOT, "data", "release-notes.json"), "utf8"));
const release = releases.find((entry) => entry.version === wanted);

if (!release) {
  console.error(`no notes for version "${wanted}"`);
  process.exit(1);
}

if (wantTitle) {
  process.stdout.write(
    (release.title ? `v${release.version} — ${release.title}` : `v${release.version}`) + "\n"
  );
} else {
  const lines = release.changes.map((change) => `- ${change}`);
  process.stdout.write([`Released ${release.date}.`, "", ...lines].join("\n") + "\n");
}
