# Messed Up Dress Up: every tune, by day

An archive of the music in [Messed Up Dress Up](http://matthewhammer.org/kids-choice-games/dress-up/), the dress-up game Matthew Hammer makes with his kids, M and N ([its source](https://github.com/matthewhammer/kids-choice-games)). One folder per day, `YYYY/MM/DD/`, holds every tune in the game at its default settings, one loop each, plus a short tail for its echoes, as an MP3. The MP3s are rendered offline from the game's own Web Audio sequencer (44.1 kHz stereo, through a limiter, `lame -V 2`). Each folder also has `manifest.json` (every tune, its loop length and its fingerprint), `source.json` (the game version and commit it came from) and `index.html` with a player for each tune.

**A tune unchanged since an earlier day is a relative symlink to that day's recording.** A tune counts as unchanged when its fingerprint matches: its notes, sections, tempo and levels, the code of every instrument it uses, and the player's and mixer's code. The day's page plays the real file.

Listen at **http://matthewhammer.org/dress-up-music/** (every day), or in the [player](http://matthewhammer.org/hazel/dress-up/music.html). `days.json` lists the days, newest first, for the player. The pictures have their own archive, made the same way: [dress-up-pictures](https://github.com/matthewhammer/dress-up-pictures).

This repository exists only to keep every past version of the game's music, for looking back. It is expected to reach GitHub's storage limits before the game does; if it does, it can move to other storage. The tools that make it (`music.mjs`, `days_index.mjs`, `archive-today.sh`) are in `tools/`.
