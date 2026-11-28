#!/usr/bin/env bash
set -euo pipefail

repository=$1
source_path=$2
site_path=${3:-.}

if [[ "$repository:$site_path" != 'syntax-platform/syntax-dev-domain:.' &&
  "$repository:$site_path" != 'syntax-platform/syntax-platform.github.io:syntax-dev' ]]; then
  echo 'Invalid Pages repository or destination path.' >&2
  exit 1
fi

source_path=$(realpath "$source_path")
test -f "$source_path/index.html"
if [[ -n $(find "$source_path" ! -type f ! -type d -print -quit) ]]; then
  echo 'The site artifact must contain only regular files and directories.' >&2
  exit 1
fi

if [[ -z "${DEPLOY_KEY:-}" ]]; then
  echo 'The Pages deploy key is missing.' >&2
  exit 1
fi

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
umask 077
printf '%s\n' "$DEPLOY_KEY" > "$work/key"
unset DEPLOY_KEY
curl --fail --silent --show-error https://api.github.com/meta |
  jq -er '.ssh_keys[] | "github.com " + .' > "$work/known_hosts"
export GIT_SSH_COMMAND="ssh -i $work/key -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile=$work/known_hosts"

remote="git@github.com:$repository.git"
for attempt in 1 2 3 4 5; do
  checkout="$work/checkout-$attempt"
  if git ls-remote --exit-code --heads "$remote" gh-pages >/dev/null; then
    git clone --quiet --single-branch --branch gh-pages --depth 1 "$remote" "$checkout"
  else
    status=$?
    if [[ "$status" != 2 ]]; then exit "$status"; fi
    git init --quiet --initial-branch=gh-pages "$checkout"
    git -C "$checkout" remote add origin "$remote"
  fi

  if [[ "$site_path" == . ]]; then
    find "$checkout" -mindepth 1 -maxdepth 1 ! -name .git ! -name CNAME -exec rm -rf {} +
  else
    rm -rf -- "$checkout/$site_path"
  fi

  mkdir -p "$checkout/$site_path"
  cp -a -- "$source_path/." "$checkout/$site_path/"
  touch "$checkout/.nojekyll"

  git -C "$checkout" add --all
  if git -C "$checkout" diff --cached --quiet; then break; fi
  git -C "$checkout" -c user.name=github-actions -c user.email=github-actions@users.noreply.github.com \
    commit --quiet -m "Deploy $site_path from ${DEPLOY_COMMIT:-${GITHUB_SHA:-local}}"
  if git -C "$checkout" push origin HEAD:refs/heads/gh-pages; then break; fi
  if [[ "$attempt" == 5 ]]; then
    echo 'Could not update the Pages branch after five attempts.' >&2
    exit 1
  fi
  sleep "$attempt"
done

if [[ "$site_path" != syntax-dev ]]; then exit 0; fi

test -n "${DEPLOY_COMMIT:-}"
for attempt in {1..24}; do
  actual=$(curl --silent --fail --max-time 10 "https://syntax-platform.github.io/syntax-dev/release-commit.txt?run=$GITHUB_RUN_ID" || true)
  if [[ "$actual" == "$DEPLOY_COMMIT" ]]; then exit 0; fi
  sleep 10
done

echo 'The public Dev route did not serve the expected commit.' >&2
exit 1
