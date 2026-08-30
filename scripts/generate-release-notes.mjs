#!/usr/bin/env node
/**
 * scripts/generate-release-notes.mjs
 *
 * Turns git history into data/release-notes.json.
 *
 * Usage:
 *   node scripts/generate-release-notes.mjs [nextVersion]
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = join(ROOT, "data", "release-notes.json");
const OVERRIDES = join(ROOT, "data", "release-notes-overrides.json");

function loadOverrides() {
  try {
    const parsed = JSON.parse(readFileSync(OVERRIDES, "utf8"));
    delete parsed._comment;
    return parsed;
  } catch {
    return {};
  }
}

function git(...args) {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
}

function isNoise(subject) {
  return (
    /^Bump version to /i.test(subject) ||
    /^Merge (branch|pull request|remote)/i.test(subject) ||
    subject.length === 0
  );
}

function versionTags() {
  const raw = git("tag", "-l", "v*");
  if (!raw) return [];
  return raw
    .split("\n")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .sort((a, b) =>
      a.slice(1).localeCompare(b.slice(1), undefined, { numeric: true, sensitivity: "base" })
    );
}

function subjectsBetween(from, to) {
  const range = from ? `${from}..${to}` : to;
  const raw = git("log", "--no-merges", "--pretty=format:%s", range);
  if (!raw) return [];
  return raw.split("\n").map((line) => line.trim()).filter((s) => !isNoise(s));
}

const GENERIC_TITLES = new Set(["housekeeping", "internal", "maintenance", "chore"]);
const FILLER_NOTE = /^internal changes only/i;

function trailersBetween(from, to) {
  const range = from ? `${from}..${to}` : to;
  const raw = git("log", "--no-merges", "--pretty=format:%b%x1e", range);
  if (!raw) return { title: null, notes: [] };

  const commits = raw.split("\x1e").map((c) => c.trim()).filter(Boolean);
  const titles = [];
  const notes = [];

  for (const body of [...commits].reverse()) {
    for (const line of body.split("\n")) {
      const match = /^(Release-Title|Release-Note):\s*(.+)$/i.exec(line.trim());
      if (!match) continue;
      if (match[1].toLowerCase() === "release-title") titles.push(match[2].trim());
      else notes.push(match[2].trim());
    }
  }

  const substantive = titles.filter((t) => !GENERIC_TITLES.has(t.toLowerCase()));
  const pool = substantive.length > 0 ? substantive : titles;
  const title = pool.length > 0 ? pool[pool.length - 1] : null;

  const unique = [...new Set(notes)];
  const real = unique.filter((note) => !FILLER_NOTE.test(note));

  return { title, notes: real.length > 0 ? real : unique };
}

function dateOf(ref) {
  return git("log", "-1", "--format=%cs", ref);
}

function build(nextVersion) {
  const tags = versionTags();
  const overrides = loadOverrides();
  const releases = [];

  const entryFor = (version, date, changes, trailers = { title: null, notes: [] }) => {
    const override = overrides[version];
    const nothingNotable =
      !override?.changes?.length && !trailers.notes.length && !changes.length;
    const body = override?.changes?.length
      ? override.changes
      : trailers.notes.length
        ? trailers.notes
        : changes.length
          ? changes
          : ["Internal changes only — nothing you can see."];
    const title =
      override?.title ?? trailers.title ?? (nothingNotable ? "Housekeeping" : body[0]);

    const housekeeping =
      nothingNotable ||
      (GENERIC_TITLES.has(title.toLowerCase()) && body.every((line) => FILLER_NOTE.test(line)));

    return { version, date, title, ...(housekeeping ? { housekeeping } : {}), changes: body };
  };

  tags.forEach((tag, i) => {
    const previous = i === 0 ? null : tags[i - 1];
    const version = tag.replace(/^v/, "");
    releases.push(
      entryFor(
        version,
        dateOf(tag),
        subjectsBetween(previous, tag),
        trailersBetween(previous, tag)
      )
    );
  });

  const alreadyTagged =
    nextVersion && tags.includes(`v${nextVersion.replace(/^v/, "")}`);

  if (nextVersion && !alreadyTagged) {
    const changes = subjectsBetween(tags[tags.length - 1] ?? null, "HEAD");
    const previous = tags[tags.length - 1] ?? null;
    releases.push(
      entryFor(
        nextVersion.replace(/^v/, ""),
        dateOf("HEAD"),
        changes,
        trailersBetween(previous, "HEAD")
      )
    );
  }

  releases.reverse();
  return releases;
}

const releases = build(process.argv[2]);
mkdirSync(dirname(OUTPUT), { recursive: true });
writeFileSync(OUTPUT, `${JSON.stringify(releases, null, 2)}\n`);
console.error(
  `wrote ${releases.length} releases to data/release-notes.json` +
    (releases[0] ? ` (newest v${releases[0].version})` : "")
);
