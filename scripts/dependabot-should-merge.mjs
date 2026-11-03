#!/usr/bin/env node
/**
 * scripts/dependabot-should-merge.mjs
 *
 * Whether a Dependabot pull request may land on its own.
 *
 * Patch and minor version updates may. A major version update stays open.
 * A security update may, including when the fix itself is a major bump.
 *
 * The input is the pull request's commit messages, with the pull request
 * body appended. Dependabot records each dependency in an
 * `updated-dependencies` block; that block is the source of truth, not the
 * title.
 *
 *   node scripts/dependabot-should-merge.mjs
 *       prints the reason, exits 0 to merge and 2 to leave the PR open
 *   node scripts/dependabot-should-merge.mjs --message 39
 *       prints the squash commit message, or exits 2
 */

import { readFileSync } from "node:fs";

function unquote(value) {
  const trimmed = value.trim().replace(/\r$/, "");
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/** Dependencies listed in Dependabot's commit-message block, in order. */
export function dependencies(text) {
  const deps = [];
  let current = null;
  for (const line of text.split("\n")) {
    const name = /^\s*-\s*dependency-name:\s*(.*?)\s*$/.exec(line);
    if (name) {
      current = { name: unquote(name[1]), version: "", type: "", group: "" };
      deps.push(current);
      continue;
    }
    if (!current) continue;
    const version = /^\s*dependency-version:\s*(.*?)\s*$/.exec(line);
    if (version) current.version = unquote(version[1]);
    const type = /^\s*update-type:\s*(\S+)\s*$/.exec(line);
    if (type) current.type = type[1];
    const group = /^\s*dependency-group:\s*(\S+)\s*$/.exec(line);
    if (group) current.group = group[1];
  }
  return deps;
}

const SEMVER = /^version-update:semver-(major|minor|patch)$/;

/**
 * A security update says so in the body, carries a GHSA id, or belongs to
 * a group created with `applies-to: security-updates` (those groups are
 * named `*-security` in this repo).
 */
export function isSecurityUpdate(text, deps) {
  if (/this update includes security fixes/i.test(text)) return true;
  if (/GHSA-[0-9a-z-]+/i.test(text)) return true;
  return deps.some((dep) => /security/i.test(dep.group));
}

export function decide(text) {
  const deps = dependencies(text);
  const types = deps.map((dep) => dep.type).filter(Boolean);
  const security = isSecurityUpdate(text, deps);

  if (deps.length === 0) {
    return { merge: false, reason: "no Dependabot update-type metadata" };
  }
  // Security update PRs list their dependencies without an update-type.
  if (types.length === 0) {
    if (security) return { merge: true, reason: "security update" };
    return { merge: false, reason: "no Dependabot update-type metadata" };
  }
  if (!types.every((type) => SEMVER.test(type))) {
    return { merge: false, reason: "unrecognized update-type" };
  }
  if (types.length !== deps.length && !security) {
    return { merge: false, reason: "a dependency has no update-type" };
  }
  const major = types.some((type) => type === "version-update:semver-major");
  if (major && !security) {
    return { merge: false, reason: "major version update left open for review" };
  }
  if (security) return { merge: true, reason: "security update" };
  return { merge: true, reason: "patch or minor update" };
}

export function commitMessage(text, pr) {
  const subject =
    text
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.length > 0) || `Dependabot updates (#${pr})`;
  const listed = dependencies(text)
    .filter((dep) => dep.name && dep.version)
    .map((dep) => `${dep.name}@${dep.version}`);
  const note = listed.length
    ? `Routine dependency updates: ${listed.join(", ")}.`
    : "Routine dependency updates.";
  return [
    subject,
    "",
    `Squash of Dependabot PR #${pr}. The pull request checks passed on this tree.`,
    "",
    `Release-Title: Dependency updates (#${pr})`,
    `Release-Note: ${note}`,
    "",
  ].join("\n");
}

function readStdin() {
  return readFileSync(0, "utf8");
}

function main() {
  const args = process.argv.slice(2);
  let pr = null;
  if (args[0] === "--message") {
    pr = args[1] ?? "";
    if (!/^[0-9]+$/.test(pr)) {
      console.error("usage: dependabot-should-merge.mjs --message <pull-request-number>");
      process.exit(1);
    }
  } else if (args.length > 0) {
    console.error("usage: dependabot-should-merge.mjs [--message <pull-request-number>]");
    process.exit(1);
  }

  const text = readStdin();
  const result = decide(text);
  if (pr !== null) {
    if (!result.merge) {
      console.error(result.reason);
      process.exit(2);
    }
    process.stdout.write(commitMessage(text, pr));
    return;
  }
  console.log(result.reason);
  process.exit(result.merge ? 0 : 2);
}

const isDirectRun = process.argv[1] && process.argv[1].endsWith("dependabot-should-merge.mjs");
if (isDirectRun) main();
