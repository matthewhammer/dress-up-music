// The page of one run's music (music/index.html): a player for every tune,
// each saying which run recorded it (a tune unchanged since then keeps that
// recording). With { release: true }, the public page for a release folder.
//   import { musicPage } from "./music_page.mjs"; musicPage(tunes, source, run)
import { when, tagOf } from "./runs.mjs";
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
const pageOf = (title, intro, rows) => `<!doctype html><meta charset="utf-8"><!-- nav: begin --><script src="https://matthewhammer.org/nav/nav.js"></script><!-- nav: end --><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title>
<style>body{font-family:sans-serif;margin:16px;max-width:820px;background:#faf8f3;color:#222} li{margin:10px 0;list-style:none} audio{width:100%;max-width:520px;display:block;margin-top:4px} small{color:#777} ul{padding:0}</style>
<h1>${esc(title)}</h1><p>${intro}</p><ul>${rows}</ul>\n`;
export function musicPage(tunes, source, run, { release = false } = {}) {
  if (release) return pageOf("Messed Up Dress Up: the tunes",
    `Every tune in <a href="../">Messed Up Dress Up</a>, at its default settings, one loop each, as MP3s. In the game they play with each place, and the mixing board changes them as you like.`,
    tunes.map(t => `<li><b>${esc(t.name)}</b> <small>${t.loopSecs} s</small><audio controls preload="none" src="${esc(t.file)}"></audio></li>`).join(""));
  const commit = source.commit || "";
  return pageOf(`Dress Up's tunes, ${run}`,
    `Every tune at its default settings, one loop each, from run ${esc(run)}, made ${esc(when(source) || "(time not recorded)")}, Messed Up Dress Up ${esc(source.version || "?")}` +
    (commit ? ` (<a href="https://github.com/matthewhammer/kids-choice-games/commit/${esc(commit)}">${esc(commit.slice(0, 7))}</a>)` : "") +
    `. A tune unchanged since an earlier run keeps that run's recording (noted). This run is the tag <a href="https://github.com/matthewhammer/dress-up-music/tree/${esc(tagOf(run))}/music"><code>${esc(tagOf(run))}</code></a>; <a href="../index.html">every run</a>.`,
    tunes.map(t => `<li><b>${esc(t.name)}</b> <small><code>${esc(t.id)}</code> · ${t.loopSecs} s a loop · ${t.recordedIn === run ? "recorded in this run" : "recorded in " + esc(t.recordedIn)}` +
      (t.failedIn ? ` · <b>did not render in this run</b>: the recording before` : "") + `</small><audio controls preload="none" src="${esc(t.file)}"></audio></li>`).join(""));
}
