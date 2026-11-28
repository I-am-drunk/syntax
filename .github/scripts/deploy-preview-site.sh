#!/usr/bin/env bash
set -euo pipefail

action=${1:-}
pr_number=${PR_NUMBER:-}
deploy_repo=${DEPLOY_REPO:-syntax-platform/syntax-infra}
deploy_url=${DEPLOY_URL:-https://syntax-platform.github.io/syntax-infra}

if [[ "$action" != "deploy" && "$action" != "remove" ]]; then
  echo 'Usage: deploy-preview-site.sh <deploy|remove> [bundle-dir]' >&2
  exit 1
fi
if [[ ! "$pr_number" =~ ^[0-9]+$ ]]; then
  echo 'PR_NUMBER must be a positive integer.' >&2
  exit 1
fi
if [[ -z "${DEPLOY_KEY:-}" ]]; then
  echo 'The Infra Pages deploy key is missing.' >&2
  exit 1
fi

guard_pr_state() {
  local current
  current=$(gh api "repos/${GITHUB_REPOSITORY:?}/pulls/$pr_number" --jq '[.state, .head.sha] | @tsv')
  if [[ "$action" == deploy && "$current" == "open"$'\t'"${DEPLOY_COMMIT}" ]]; then return; fi
  if [[ "$action" == remove && "$current" == "closed"$'\t'* ]]; then return; fi
  echo 'The pull request changed since this run started. Leave the preview for the current run.'
  exit 0
}

source_path=""
if [[ "$action" == "deploy" ]]; then
  source_path=$(realpath "${2:-}")
  test -f "$source_path/index.html"
  test -n "${DEPLOY_COMMIT:-}"
  if [[ -n $(find "$source_path" ! -type f ! -type d -print -quit) ]]; then
    echo 'The preview artifact must contain only regular files and directories.' >&2
    exit 1
  fi
fi
guard_pr_state

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

remote="git@github.com:${deploy_repo}.git"
preview_dir="pr-${pr_number}"

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

  touch "$checkout/.nojekyll"
  if [[ ! -f "$checkout/index.html" ]]; then
    cat > "$checkout/index.html" <<'EOF'
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Syntax Infra Previews</title>
</head>
<body>
  <main style="font-family: system-ui, sans-serif; max-width: 600px; margin: 4rem auto; padding: 0 1.25rem;">
    <h1>Syntax Infra PR Previews</h1>
    <p>Each pull request preview is served under <code>/syntax-infra/pr-&lt;number&gt;/</code>.</p>
  </main>
</body>
</html>
EOF
  fi

  if [[ "$action" == "deploy" ]]; then
    rm -rf "${checkout:?}/${preview_dir}"
    mkdir -p "$checkout/$preview_dir"
    cp -a -- "$source_path/." "$checkout/$preview_dir/"
    commit_msg="Deploy PR #${pr_number} preview from ${DEPLOY_COMMIT}"
  else
    rm -rf "${checkout:?}/${preview_dir}"
    commit_msg="Remove PR #${pr_number} preview"
  fi

  git -C "$checkout" add --all
  if git -C "$checkout" diff --cached --quiet; then break; fi
  git -C "$checkout" -c user.name=github-actions -c user.email=github-actions@users.noreply.github.com \
    commit --quiet -m "$commit_msg"
  guard_pr_state
  if git -C "$checkout" push origin HEAD:refs/heads/gh-pages; then break; fi
  if [[ "$attempt" == 5 ]]; then
    echo 'Could not update the Infra Pages branch after five attempts.' >&2
    exit 1
  fi
  sleep "$attempt"
done

for attempt in {1..24}; do
  guard_pr_state
  if [[ "$action" == deploy ]]; then
    actual=$(curl --silent --fail --max-time 10 "${deploy_url%/}/${preview_dir}/preview-commit.txt?run=${GITHUB_RUN_ID:-0}" || true)
    if [[ "$actual" == "$DEPLOY_COMMIT" ]]; then exit 0; fi
  else
    status=$(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 10 "${deploy_url%/}/${preview_dir}/?run=${GITHUB_RUN_ID:-0}" || true)
    if [[ "$status" == 404 ]]; then exit 0; fi
  fi
  sleep 10
done
echo 'The public Infra preview did not reach the expected state.' >&2
exit 1
