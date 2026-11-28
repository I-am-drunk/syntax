#!/usr/bin/env bash
set -euo pipefail

source_path=$(realpath "$1")
test -f "$source_path/index.html"
test -n "${DEPLOY_COMMIT:-}"
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
curl_args=(--fail --silent --show-error)
if [[ -n "${GH_TOKEN:-}" ]]; then
  curl_args+=(-H "Authorization: Bearer ${GH_TOKEN}" -H "X-GitHub-Api-Version: 2022-11-28")
fi
curl "${curl_args[@]}" --retry 3 https://api.github.com/meta |
  jq -er '.ssh_keys[] | "github.com " + .' > "$work/known_hosts"
test -s "$work/known_hosts"
export GIT_SSH_COMMAND="ssh -i $work/key -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile=$work/known_hosts"

deploy_repo=${DEPLOY_REPO:-syntax-platform/syntax-dev}
deploy_url=${DEPLOY_URL:-https://syntax-platform.github.io/syntax-dev}
deploy_label=${DEPLOY_LABEL:-Dev}
deploy_marker=${DEPLOY_MARKER:-release-commit.txt}
remote="git@github.com:${deploy_repo}.git"
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

  preserved=(! -name .git ! -name CNAME)
  if [[ "${PRESERVE_NIGHTLY_DOCS:-false}" == true ]]; then
    preserved+=(! -name docs ! -name storybook)
  fi
  find "$checkout" -mindepth 1 -maxdepth 1 "${preserved[@]}" -exec rm -rf {} +
  cp -a -- "$source_path/." "$checkout/"
  touch "$checkout/.nojekyll"

  git -C "$checkout" add --all
  if git -C "$checkout" diff --cached --quiet; then break; fi
  git -C "$checkout" -c user.name=github-actions -c user.email=github-actions@users.noreply.github.com \
    commit --quiet -m "Deploy $deploy_label from $DEPLOY_COMMIT"
  if git -C "$checkout" push origin HEAD:refs/heads/gh-pages; then break; fi
  if [[ "$attempt" == 5 ]]; then
    echo 'Could not update the Pages branch after five attempts.' >&2
    exit 1
  fi
  sleep "$attempt"
done

for attempt in {1..24}; do
  actual=$(curl --silent --fail --max-time 10 "${deploy_url%/}/${deploy_marker}?run=${GITHUB_RUN_ID:-0}" || true)
  if [[ "$actual" == "$DEPLOY_COMMIT" ]]; then exit 0; fi
  sleep 10
done

echo "The public $deploy_label route did not serve the expected commit." >&2
exit 1
