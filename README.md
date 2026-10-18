# Messed Up Dress Up: every tune, run by run

An archive of the music in [Messed Up Dress Up](https://matthewhammer.org/kids-choice-games/dress-up/), the dress-up game Matthew Hammer makes with his kids, M and N ([its source](https://github.com/matthewhammer/kids-choice-games)). Each run of the archive records every tune in the game at its default settings, one loop each, plus a short tail for its echoes, as an MP3. The MP3s are rendered offline from the game's own Web Audio sequencer (44.1 kHz stereo, through a limiter, `lame -V 2`).

## One copy of each tune, every run in git

There is one copy of each tune, **`music/<tune>.mp3`** (since 2026-10-18; before that, a folder per day). Every run writes the same folder, and the runs before it are in git's history, each one **a tag**, `run-YYYY-MM-DD` (a later run that day: `run-YYYY-MM-DD-HH-MM`, in Mountain time).

A run records only what changed. Each tune has a fingerprint: its notes, sections, tempo and levels, the code of every instrument it uses, and the player's and mixer's code. A tune whose fingerprint matches the run before keeps that run's file untouched, so git stores it once, and `music/manifest.json` says which run recorded it (`recordedIn`). A tune that fails to render keeps its last recording (`failedIn` says so). A tune gone from the game goes from the folder; it stays in the tags.

Also in `music/`: `source.json` (the game version and commit, and when and where the run was made) and `index.html`, a player for each tune. At the top, `runs.json` lists every run, newest first, with its tag; `index.html` is the same list.

## Listening back

- **The newest run** is on the site: **https://matthewhammer.org/dress-up-music/**.
- **Any run**, in the [music player](https://matthewhammer.org/hazel/dress-up/music.html): it plays an earlier run from its tag.
- **A run's files** on GitHub: the tag's tree (`/tree/run-…/music`), or the whole run as a zip (`/archive/refs/tags/run-….zip`).

An old link into a day's folder is sent to the music player at that run. The pictures have their own archive, made the same way: [dress-up-pictures](https://github.com/matthewhammer/dress-up-pictures).

## Making a run

On GitHub's computers, not the laptop (it crashes under load): the "Dress Up archive" workflow in [kids-choice-games](https://github.com/matthewhammer/kids-choice-games) runs `tools/music.mjs` in headless Chrome on the game at `main`, starting from this archive's `music/`, and uploads the run as an artifact. Then, here:

```
gh run download <run id> -R matthewhammer/kids-choice-games -n music -D <an empty folder>
tools/add_run.sh <that folder>
```

`add_run.sh` checks the run, puts it in `music/`, lists it (`runs_index.mjs`), commits, tags and pushes. The tools: `music.mjs` (the recordings), `music_page.mjs` (a run's page), `runs_index.mjs` (the list of runs), `runs.mjs` (what they share), `add_run.sh`, and `site.json` (this archive's title and links). `runs.mjs`, `runs_index.mjs` and `add_run.sh` are the same as the picture archive's.
