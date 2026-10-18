#!/bin/bash
# Adds a run made on GitHub's computers (the "Dress Up archive" workflow in
# matthewhammer/kids-choice-games; its artifact holds run.tar and run.txt) to
# this archive: checks the tar (plain files and folders under the run folder,
# nothing else, no empty file), puts its folder in place of the old one, lists
# the run (runs_index.mjs), commits, tags it run-YYYY-MM-DD[-HH-MM], pushes.
# The same script serves dress-up-pictures (pictures/) and dress-up-music
# (music/): tools/site.json names the folder. Light work: no browser, no
# ffmpeg, one rsync and one commit (this laptop crashes under load).
# (ticket 277) After the commit, what the run added to git (the thin pack a
# push of it sends) goes into its runs.json entry, amended in before the push.
# (ticket 276) The archive workflow runs this too, on GitHub, in a fresh clone
# whose origin carries its token: the same checks, the same commit.
#   tools/add_run.sh <the artifact's folder>   (gh run download <id> -R matthewhammer/kids-choice-games -n <name> -D <folder>)
#   (ADD_RUN_SCRATCH: where to unpack it; ~/du-shots by default)
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd)
IN=$(cd "$1" && pwd)
FOLDER=$(node -p 'JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).folder' "$ROOT/tools/site.json")
RUN=$(tr -d '\n' < "$IN/run.txt"); TAG="run-${RUN//\//-}"
[[ "$RUN" =~ ^[0-9]{4}/[0-9]{2}/[0-9]{2}(/[0-9]{2}-[0-9]{2})?$ ]] || { echo "not a run: $RUN"; exit 1; }
[ -z "$(git -C "$ROOT" status --porcelain)" ] || { echo "the archive has changes not committed: stopping"; exit 1; }
[ -z "$(git -C "$ROOT" tag -l "$TAG")" ] || { echo "$TAG is already here"; exit 1; }
python3 -I - "$IN/run.tar" "$FOLDER" <<'PY'
import sys, tarfile, posixpath
tar, folder = sys.argv[1], sys.argv[2]
bad = []
for m in tarfile.open(tar):
    n = posixpath.normpath(m.name)
    if not (m.isfile() or m.isdir()): bad.append("not a plain file: " + m.name)
    elif n.startswith("/") or ".." in n.split("/") or not (n == folder or n.startswith(folder + "/")): bad.append("outside " + folder + "/: " + m.name)
    elif m.isfile() and m.size == 0: bad.append("empty: " + m.name)
if bad: print("\n".join(bad[:20])); sys.exit(1)
PY
mkdir -p "${ADD_RUN_SCRATCH:-$HOME/du-shots}"; SCR=$(mktemp -d "${ADD_RUN_SCRATCH:-$HOME/du-shots}/incoming-XXXXXX")
tar -C "$SCR" -xf "$IN/run.tar"
for f in manifest.json source.json index.html; do [ -s "$SCR/$FOLDER/$f" ] || { echo "the run has no $f"; exit 1; }; done
nice -n 10 rsync -a --delete "$SCR/$FOLDER/" "$ROOT/$FOLDER/"
node "$ROOT/tools/runs_index.mjs" "$ROOT" "$RUN"
V=$(node -p 'JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).version' "$ROOT/$FOLDER/source.json")
git -C "$ROOT" add -A "$FOLDER" runs.json index.html
echo "$RUN: $(git -C "$ROOT" diff --cached --shortstat)"
WHO=(-c user.name="Matthew Hammer" -c user.email=matthew.hammer@gmail.com)
MSG="$RUN: Messed Up Dress Up $V"; [ -n "${GITHUB_RUN_ID:-}" ] && MSG="$MSG

Added by matthewhammer/kids-choice-games run $GITHUB_RUN_ID (ticket 276)."
git -C "$ROOT" "${WHO[@]}" commit -q -m "$MSG"
ADDED=$(printf '%s\n^%s\n' HEAD HEAD^ | git -C "$ROOT" pack-objects --revs --thin --stdout -q | wc -c)
node "$ROOT/tools/runs_index.mjs" "$ROOT" "$RUN" --added "$ADDED" > /dev/null
git -C "$ROOT" add runs.json index.html && git -C "$ROOT" "${WHO[@]}" commit -q --amend --no-edit
git -C "$ROOT" tag "$TAG"
git -C "$ROOT" push -q origin main "refs/tags/$TAG"
rm -rf "$SCR"
echo "added $RUN ($V) as $TAG, $(( ADDED / 1024 )) KiB in git, pushed"
