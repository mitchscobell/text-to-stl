#!/usr/bin/env bash
#
# scripts/dependabot-auto-merge.sh
#
# Lands a Dependabot pull request whose checks have already passed on this
# exact head. Patch, minor, and security updates only; a major version bump
# stays open.
#
# The commit is created locally and pushed, as Mitch. A squash through the
# GitHub API would record dependabot[bot] or the Actions app as the author.
# The push uses the workflow token, which does not start push workflows, so
# the release workflow is dispatched afterwards.
#

set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

: "${GH_TOKEN:?}"
: "${HEAD_SHA:?}"
: "${GITHUB_REPOSITORY:?}"
: "${GIT_AUTHOR_NAME:?}"
: "${GIT_AUTHOR_EMAIL:?}"
: "${GIT_COMMITTER_NAME:?}"
: "${GIT_COMMITTER_EMAIL:?}"

if [ "$GIT_AUTHOR_NAME" != "Mitch Scobell" ] || [ "$GIT_COMMITTER_NAME" != "Mitch Scobell" ]; then
  echo "refusing to commit as $GIT_AUTHOR_NAME / $GIT_COMMITTER_NAME" >&2
  exit 1
fi
if [ "$GIT_AUTHOR_EMAIL" != "6463310+mitchscobell@users.noreply.github.com" ] \
  || [ "$GIT_COMMITTER_EMAIL" != "6463310+mitchscobell@users.noreply.github.com" ]; then
  echo "refusing to commit as $GIT_AUTHOR_EMAIL / $GIT_COMMITTER_EMAIL" >&2
  exit 1
fi

export GIT_AUTHOR_NAME GIT_AUTHOR_EMAIL GIT_COMMITTER_NAME GIT_COMMITTER_EMAIL

comment() {
  gh pr comment "$PR_NUMBER" --body "$1" || echo "could not comment on #$PR_NUMBER" >&2
}

# Only comments made since the pull request's current head count. An older
# "@dependabot rebase" was answered by the rebase that produced this head,
# so it must not stop the next request.
already_commented() {
  local since
  since=$(gh pr view "$PR_NUMBER" --json commits --jq '.commits[-1].committedDate')
  gh api --paginate "repos/${GITHUB_REPOSITORY}/issues/${PR_NUMBER}/comments" \
    --jq ".[] | select(.created_at >= \"${since}\") | .body" \
    | grep -F -q -- "$1"
}

if [ -z "${PR_NUMBER:-}" ] || [ "$PR_NUMBER" = "null" ]; then
  PR_NUMBER=$(gh api -H "Accept: application/vnd.github+json" \
    "repos/${GITHUB_REPOSITORY}/commits/${HEAD_SHA}/pulls" --jq '.[0].number // empty')
fi
if [ -z "${PR_NUMBER:-}" ]; then
  echo "no pull request for $HEAD_SHA; nothing to land"
  exit 0
fi

state=$(gh pr view "$PR_NUMBER" --json state,headRefOid,headRefName --jq .state)
head_oid=$(gh pr view "$PR_NUMBER" --json state,headRefOid,headRefName --jq .headRefOid)
HEAD_BRANCH=$(gh pr view "$PR_NUMBER" --json state,headRefOid,headRefName --jq .headRefName)

if [ "$state" != "OPEN" ]; then
  echo "pull request #$PR_NUMBER is $state; nothing to land"
  exit 0
fi
if [ "$head_oid" != "$HEAD_SHA" ]; then
  echo "pull request #$PR_NUMBER moved from $HEAD_SHA to $head_oid; waiting for the new checks"
  exit 0
fi
case "$HEAD_BRANCH" in
  dependabot/*) ;;
  *)
    echo "branch $HEAD_BRANCH is not a Dependabot branch"
    exit 0
    ;;
esac

git fetch origin master --quiet
git fetch origin "$HEAD_BRANCH" --quiet
if [ "$(git rev-parse "origin/$HEAD_BRANCH")" != "$HEAD_SHA" ]; then
  echo "origin/$HEAD_BRANCH is not $HEAD_SHA; waiting for the new checks"
  exit 0
fi

# The tested tree is the pull request head. If master has moved, that tree is
# no longer what would land, so ask Dependabot to rebase and let the new
# head run checks before anything is pushed.
if [ "$(git merge-base origin/master "$HEAD_SHA")" != "$(git rev-parse origin/master)" ]; then
  echo "master moved under #$PR_NUMBER; asking Dependabot to rebase"
  if ! already_commented "@dependabot rebase"; then
    comment "@dependabot rebase"
  fi
  exit 0
fi

commit_text="$(mktemp)"
commit_msg="$(mktemp)"
trap 'rm -f "$commit_text" "$commit_msg"' EXIT
git log --format=%B "origin/master..$HEAD_SHA" > "$commit_text"
gh pr view "$PR_NUMBER" --json body --jq .body >> "$commit_text"

set +e
node scripts/dependabot-should-merge.mjs --message "$PR_NUMBER" < "$commit_text" > "$commit_msg"
decision=$?
set -e
if [ "$decision" -eq 2 ]; then
  reason=$(node scripts/dependabot-should-merge.mjs < "$commit_text" || true)
  echo "not auto-merging #$PR_NUMBER: $reason"
  if ! already_commented "left open for review"; then
    comment "Leaving this pull request open for review (${reason})."
  fi
  exit 0
fi
if [ "$decision" -ne 0 ]; then
  echo "could not decide whether to merge #$PR_NUMBER (exit $decision)" >&2
  exit 1
fi

git checkout -B master origin/master
if ! git merge --squash "$HEAD_SHA"; then
  git reset --hard origin/master
  echo "squash of #$PR_NUMBER conflicted; asking Dependabot to rebase"
  if ! already_commented "@dependabot rebase"; then
    comment "@dependabot rebase"
  fi
  exit 0
fi
if git diff --cached --quiet; then
  echo "pull request #$PR_NUMBER has nothing that is not already on master"
  comment "These updates are already on master. Closing."
  gh pr close "$PR_NUMBER" || true
  exit 0
fi

git config --local user.name "$GIT_AUTHOR_NAME"
git config --local user.email "$GIT_AUTHOR_EMAIL"
git commit -F "$commit_msg"

identity=$(git log -1 --format='%an%n%ae%n%cn%n%ce')
expected=$(printf '%s\n' \
  "Mitch Scobell" \
  "6463310+mitchscobell@users.noreply.github.com" \
  "Mitch Scobell" \
  "6463310+mitchscobell@users.noreply.github.com")
if [ "$identity" != "$expected" ]; then
  echo "commit identity was not Mitch's:" >&2
  printf '%s\n' "$identity" >&2
  exit 1
fi
if [ "$(git rev-parse 'HEAD^{tree}')" != "$(git rev-parse "${HEAD_SHA}^{tree}")" ]; then
  echo "squash tree does not match the tested head $HEAD_SHA" >&2
  exit 1
fi

# No npm ci here. The tree is the tested head, and the release workflow
# regenerates data/release-notes.json when it bumps the version. Under the
# runner's _work dir the global hooks stand aside, so .githooks/pre-push
# (which would ask for regenerated notes) does not run on this push.

master_at=$(git rev-parse origin/master)
if ! git push origin HEAD:master; then
  git fetch origin master --quiet
  if [ "$(git rev-parse origin/master)" != "$master_at" ]; then
    echo "push raced; asking Dependabot to rebase onto the new master"
    if ! already_commented "@dependabot rebase"; then
      comment "@dependabot rebase"
    fi
    exit 0
  fi
  echo "push failed and origin/master did not advance" >&2
  exit 1
fi

landed=$(git rev-parse HEAD)

# The token that just pushed will not start the release workflow. Dispatch
# it before closing the pull request: the bump has to run even if the
# comment does not.
dispatched=0
for attempt in 1 2 3 4 5; do
  if gh workflow run build-test-version.yml --ref master; then
    dispatched=1
    echo "dispatched the release workflow (attempt $attempt)"
    break
  fi
  echo "dispatch attempt $attempt failed; retrying"
  sleep $((attempt * 3))
done

comment "Landed on master as ${landed} after the pull request checks passed on ${HEAD_SHA}."
gh pr close "$PR_NUMBER" --comment "Dependency updates are on master as ${landed}." || true

if [ "$dispatched" -ne 1 ]; then
  echo "landed ${landed} but could not dispatch the release workflow" >&2
  exit 1
fi
