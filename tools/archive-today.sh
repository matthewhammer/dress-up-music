#!/bin/bash
# Archive today's Messed Up Dress Up: its pictures into ~/dress-up-pictures
# (repo matthewhammer/dress-up-pictures) and its music into ~/dress-up-music
# (repo matthewhammer/dress-up-music), each under YYYY/MM/DD, drawn from the
# game as it is in ~/kids-choice-games now, with a source.json saying which
# version and commit that was. Then each archive's front page, and a commit
# in each repo; with --push, a push too (each repo's Pages site serves it).
#   archive-today.sh [pictures|music|both] [--push]
# Needs headless Chrome (muted) with DevTools on $PORT (default 9333).
# One heavy job at a time: this laptop crashes under load.
set -euo pipefail
WHAT=${1:-both}; PUSH=${2:-}
PORT=${PORT:-9333}
GAME=~/kids-choice-games; PICS=~/dress-up-pictures; MUSIC=~/dress-up-music
# (each archive's own tools, in its repository: the copies there are the real ones)
DAY=$(date +%Y/%m/%d)
PAGE=~/du-shots/work.html
cp "$GAME/dress-up/index.html" "$PAGE"
# (the version: the newest released one, and "+ unreleased" if the page has changes past it)
REL=$(grep -m1 -oE '^## [0-9]+\.[0-9]+\.[0-9]+' "$GAME/dress-up/VERSIONS.md" | cut -c4-)
VERSION=$REL
grep -m1 '^## ' "$GAME/dress-up/VERSIONS.md" | grep -q Unreleased && VERSION="$REL + unreleased changes"
git -C "$GAME" diff --quiet HEAD -- dress-up/index.html || VERSION="$VERSION (+ uncommitted changes)"
COMMIT=$(git -C "$GAME" rev-parse HEAD)
source_json() { printf '{\n "game": "Messed Up Dress Up",\n "version": "%s",\n "commit": "%s",\n "made_at": "%s"\n}\n' "$VERSION" "$COMMIT" "$(date -Iseconds)" > "$1/source.json"; }
if [ "$WHAT" != music ]; then
  node "$PICS/tools/archive.mjs" "$PORT" "file://$PAGE" "$PICS/$DAY" "http://matthewhammer.org/dress-up-music/$DAY/index.html"
  source_json "$PICS/$DAY"
  node "$PICS/tools/days_index.mjs" "$PICS" "Messed Up Dress Up: every picture, by day" \
    'Each day: every background (with and without the friend) and every chip menu at its defaults, as a 1920-wide PNG, an SVG and its settings (Load opens them in <a href="http://matthewhammer.org/kids-choice-games/dress-up/">the game</a>). A picture unchanged since an earlier day is that day&rsquo;s file. 🎵 <a href="http://matthewhammer.org/dress-up-music/">The music, by day</a>.'
  git -C "$PICS" add -A && git -C "$PICS" -c user.email=matthew.hammer@gmail.com commit -q -m "$DAY: Messed Up Dress Up $VERSION" || echo "pictures: nothing new to commit"
fi
if [ "$WHAT" != pictures ]; then
  node "$MUSIC/tools/music.mjs" "$PORT" "file://$PAGE" "$MUSIC" "$DAY" "" "http://matthewhammer.org/dress-up-pictures/$DAY/index.html"
  source_json "$MUSIC/$DAY"
  node "$MUSIC/tools/days_index.mjs" "$MUSIC" "Messed Up Dress Up: every tune, by day" \
    'Each day: every tune in <a href="http://matthewhammer.org/kids-choice-games/dress-up/">the game</a> at its default settings, one loop each, as an MP3. A tune unchanged since an earlier day plays that day&rsquo;s recording. 🖼️ <a href="http://matthewhammer.org/dress-up-pictures/">The pictures, by day</a>.'
  git -C "$MUSIC" add -A && git -C "$MUSIC" -c user.email=matthew.hammer@gmail.com commit -q -m "$DAY: Messed Up Dress Up $VERSION" || echo "music: nothing new to commit"
fi
if [ "$PUSH" = --push ]; then
  [ "$WHAT" != music ] && git -C "$PICS" push -q origin HEAD
  [ "$WHAT" != pictures ] && git -C "$MUSIC" push -q origin HEAD
fi
echo "archived $DAY: $VERSION ($COMMIT)"
