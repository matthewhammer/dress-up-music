// The front page of a Dress Up archive (dress-up-pictures or dress-up-music),
// and runs.json: every run, newest first, each with the game version it
// recorded and its git tag. Since 2026-10-18 a run is not a folder of its
// own: every run writes the same folder (pictures/ or music/), and the runs
// before are in git, each a tag, run-YYYY-MM-DD[-HH-MM]. So only the newest
// run is on the site; the viewer (the url given) reads an older one from its
// tag, and GitHub shows its files and gives it as a zip.
// Run it after the new run's folder is in place (its source.json says what
// it is), before the commit that adds it; then tag that commit (add_run.sh
// does all of it). The archive's tools/site.json names its run folder, its
// repository, its title and introduction, and the viewer.
// (ticket 277) With --added <bytes>, what the run added to git: the thin pack
// a push of it sends, its files as differences from the run before
// (add_run.sh measures it after the run's commit); the front page shows each
// run's and the total.
//   node runs_index.mjs <archive root> <run: YYYY/MM/DD[/HH-MM]> [--added <bytes>]
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { when, tagOf } from "./runs.mjs";
const [root, run] = process.argv.slice(2), ai = process.argv.indexOf("--added"), added = ai > 0 ? Number(process.argv[ai + 1]) : null;
if (!run) { console.log("usage: node runs_index.mjs <archive root> <run>"); process.exit(1); }
const { folder, repo, title, intro, viewer } = JSON.parse(readFileSync(join(root, "tools", "site.json"), "utf8"));
const src = JSON.parse(readFileSync(join(root, folder, "source.json"), "utf8"));
const file = join(root, "runs.json");
const before = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : [], had = before.find(r => r.run === run);
const runs = before.filter(r => r.run !== run);
runs.unshift({ run, tag: tagOf(run), when: when(src), version: src.version ?? null, commit: src.commit ?? null, made_at: src.made_at ?? null, made_on: src.made_on ?? null,
               added_bytes: added ?? had?.added_bytes ?? null });
runs.sort((a, b) => b.run.localeCompare(a.run));
writeFileSync(file, JSON.stringify(runs, null, 1) + "\n");
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
const mib = b => (b / 1048576).toFixed(b < 10485760 ? 2 : 1) + " MiB";
const size = r => r.added_bytes != null ? ` <small>· added ${mib(r.added_bytes)}</small>` : "";
const total = runs.reduce((t, r) => t + (r.added_bytes ?? 0), 0), counted = runs.filter(r => r.added_bytes != null).length;
const game = r => r.version ? ` <small>· Messed Up Dress Up ${esc(r.version)}` +
  (r.commit ? ` (<a href="https://github.com/matthewhammer/kids-choice-games/commit/${esc(r.commit)}">${esc(r.commit.slice(0, 7))}</a>)` : "") + `</small>` : "";
writeFileSync(join(root, "index.html"), `<!doctype html><meta charset="utf-8"><!-- nav: begin --><script src="https://matthewhammer.org/nav/nav.js"></script><!-- nav: end --><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title>
<style>body{font-family:sans-serif;margin:16px;max-width:820px;background:#faf8f3;color:#222} li{margin:8px 0} small{color:#777}</style>
<h1>${esc(title)}</h1><p>${intro}</p>` + (counted ? `<p><small>What the runs added to git: ${mib(total)} for ${counted} of ${runs.length} runs (each, the thin pack a push of it sends: its files as differences from the run before).</small></p>` : "") + `<ul>` +
  runs.map((r, i) => `<li>` + (i === 0 ? `<a href="${esc(folder)}/index.html">${esc(r.run)}</a> <small>(the newest)</small>` : `<a href="${esc(viewer)}?run=${encodeURIComponent(r.run)}">${esc(r.run)}</a>`) +
    (r.when ? ` <small>· made ${esc(r.when)}</small>` : "") + game(r) + size(r) +
    ` <small>· <a href="https://github.com/${esc(repo)}/tree/${esc(r.tag)}/${esc(folder)}">its files</a>, <a href="https://github.com/${esc(repo)}/archive/refs/tags/${esc(r.tag)}.zip">as a zip</a></small></li>`).join("") +
  `</ul>\n`);
console.log(runs.length, "runs listed in", file, "and", join(root, "index.html"));
