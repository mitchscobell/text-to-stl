#!/usr/bin/env node
/**
 * scripts/set-release-title.mjs
 *
 * Adds the release headline to the most recent commit, as git trailers.
 *
 *   npm run release-title "Dark theme redesign" "Rebuilt the UI with a dark theme."
 */

import { execFileSync } from "node:child_process";

const [title, ...notes] = process.argv.slice(2);

if (!title) {
  console.error(
    'usage: npm run release-title "Headline" ["A user-facing note" ...]'
  );
  process.exit(1);
}

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
}

try {
  const upstream = git("rev-parse", "--abbrev-ref", "@{upstream}").trim();
  const merged = git("branch", "--contains", "HEAD", "-r").trim();
  if (merged.includes(upstream)) {
    console.error(
      `HEAD is already pushed to ${upstream}. Put the trailer on your next commit instead.`
    );
    process.exit(1);
  }
} catch {
  // No upstream yet. Carry on.
}

const trailers = [
  "--trailer",
  `Release-Title: ${title}`,
  ...notes.flatMap((note) => ["--trailer", `Release-Note: ${note}`]),
];

git("commit", "--amend", "--no-edit", ...trailers);
console.log(`Release-Title: ${title}`);
for (const note of notes) console.log(`Release-Note: ${note}`);
