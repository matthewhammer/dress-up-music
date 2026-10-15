// The day's music for the Dress Up archive: every tune, at its default
// settings, for one loop (and a short tail for its echoes), as an MP3, in
// <archive>/<YYYY/MM/DD>/<tune id>.mp3, with a manifest and a page of
// players (the archive is its own repository, matthewhammer/dress-up-music). A tune unchanged since an earlier day (the same fingerprint: its
// notes, sections, tempo and levels, the code of every instrument it uses,
// and the player's and mixer's code) is a relative symlink to that day's
// file instead of a new render; the day's page plays the real file. With a
// release folder, the day's MP3s are also copied there (real files) with a
// public page listing them.
//   node music.mjs <devtools port> <page url> <archive root> <YYYY/MM/DD> [release dir] [pictures url]
import { writeFileSync, mkdirSync, readFileSync, existsSync, readdirSync, symlinkSync, realpathSync, copyFileSync, rmSync, unlinkSync, lstatSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, relative, dirname } from "node:path";
const [dport, url, root, day, release, picturesUrl] = process.argv.slice(2);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const page = (await (await fetch(`http://127.0.0.1:${dport}/json/list`)).json()).find(t => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener("open", r, { once: true }));
let n = 0; const pending = new Map();
ws.addEventListener("message", e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
const send = (method, params = {}) => new Promise(res => { const i = ++n; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const evalJs = async expression => { const r = await send("Runtime.evaluate", { expression, returnByValue: true }); if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 400)); return r.result.result.value; };
await send("Page.enable"); await send("Runtime.enable");
await send("Page.navigate", { url: "about:blank" }); await sleep(300);
await send("Page.navigate", { url }); await sleep(4000);
// 1. the tunes, their names and loop lengths, and their fingerprints
const tunes = await evalJs(`(() => {
  const h = (s, seed) => { let x = seed >>> 0; for (let i = 0; i < s.length; i++) x = Math.imul(x ^ s.charCodeAt(i), 2654435761) >>> 0; return x.toString(16).padStart(8, "0"); };
  const code = [playNote, busesOf, timeOf, stepSecs, amp, held, tone, filter, noise, gainOf].map(String).join("") + (typeof swingOf === "function" ? String(swingOf) : "");
  return Object.keys(TUNES).map(id => { const song = songOf(id), insts = [...new Set(song.T.parts.map(p => p.inst))].sort();
    const fp = JSON.stringify({ T: song.T, steps: song.steps, events: song.events }, (k, v) => typeof v === "function" ? String(v) : v) + insts.map(i => String(INSTRUMENTS[i])).join("") + code;
    return { id, name: TUNES[id].name, loopSecs: +(song.steps * stepSecs(song.T)).toFixed(2), fingerprint: h(fp, 1) + h(fp, 7) }; });
})()`);
// 2. the earlier days' music, newest first, for unchanged tunes to link to
const musicDir = join(root, day);
const earlier = [];
for (const y of existsSync(root) ? readdirSync(root).filter(d => /^\d{4}$/.test(d)) : [])
  for (const m of readdirSync(join(root, y)).filter(d => /^\d{2}$/.test(d)))
    for (const d of readdirSync(join(root, y, m)).filter(d => /^\d{2}$/.test(d))) {
      const k = `${y}/${m}/${d}`, mf = join(root, k, "manifest.json");
      if (k < day && existsSync(mf)) earlier.push({ day: k, manifest: JSON.parse(readFileSync(mf, "utf8")) });
    }
earlier.sort((a, b) => b.day.localeCompare(a.day));
mkdirSync(musicDir, { recursive: true });
// (today's own recordings so far, from an earlier run today that stopped part way: a tune whose
// fingerprint still matches keeps its file, so a re-run picks up where the last one stopped)
const todayMf = join(musicDir, "manifest.json"), today = new Map();
if (existsSync(todayMf)) for (const m of JSON.parse(readFileSync(todayMf, "utf8"))) today.set(m.id, m);
const present = f => { try { lstatSync(f); return true; } catch (_) { return false; } };
// 3. each tune: kept from earlier today, a link to its unchanged self on an earlier day, or a new render
const out = [], saveManifest = () => writeFileSync(todayMf, JSON.stringify(out, null, 1));
for (const t of tunes) {
  const file = join(musicDir, t.id + ".mp3"), had = today.get(t.id);
  if (had && had.fingerprint === t.fingerprint && present(file) && existsSync(file)) { out.push(had); saveManifest(); process.stdout.write("k"); continue; }
  if (present(file)) unlinkSync(file);
  const same = earlier.map(e => ({ e, m: e.manifest.find(m => m.id === t.id && m.fingerprint === t.fingerprint) })).find(x => x.m);
  if (same) {
    // (to the file itself, not to another link: realpath)
    const target = realpathSync(join(root, same.e.day, t.id + ".mp3"));
    symlinkSync(relative(musicDir, target), file);
    out.push({ ...t, file: t.id + ".mp3", real: relative(musicDir, target), sameAsDay: same.m.sameAsDay || same.e.day }); saveManifest();
    process.stdout.write("=");
    continue;
  }
  await evalJs(`window.__tune = null; (async () => { try {
    const song = songOf(${JSON.stringify(t.id)}), loop = song.steps * stepSecs(song.T), secs = loop + 2.6, rate = 44100;
    const A = new OfflineAudioContext(2, Math.ceil(secs * rate), rate);
    const limit = A.createDynamicsCompressor(); limit.threshold.value = -10; limit.ratio.value = 8; limit.connect(A.destination);
    // (one loop, then its echoes dying away, faded out at the very end)
    const fade = A.createGain(); fade.connect(limit); fade.gain.setValueAtTime(1, loop + 1.9); fade.gain.linearRampToValueAtTime(0, loop + 2.5);
    const into = gainOf(A, fade, song.T.level ?? 1), buses = busesOf(A, song.T, into);
    for (const ev of song.events) playNote(A, buses, song, ev, timeOf(song, 0.05, 0, ev.at));
    const buf = await A.startRendering(), N = buf.length, L = buf.getChannelData(0), R = buf.getChannelData(1), pcm = new Int16Array(N * 2);
    for (let i = 0; i < N; i++) { pcm[2 * i] = Math.max(-1, Math.min(1, L[i])) * 32767; pcm[2 * i + 1] = Math.max(-1, Math.min(1, R[i])) * 32767; }
    const bytes = new Uint8Array(pcm.buffer); let bin = ""; for (let i = 0; i < bytes.length; i += 32768) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 32768));
    window.__tune = { b64: btoa(bin), rate };
  } catch (e) { window.__tune = { error: String(e) }; } })(); "ok"`);
  // (a long, busy tune takes minutes to render: up to 20 for any one)
  let meta = null; const t0 = Date.now();
  while (!meta && Date.now() - t0 < 20 * 60e3) { await sleep(1000); meta = await evalJs("window.__tune && JSON.stringify({ error: window.__tune.error, rate: window.__tune.rate })"); }
  if (!meta) { console.log("\n" + t.id, "TIMED OUT after 20 min"); continue; }
  meta = JSON.parse(meta); if (meta.error) { console.log("\n" + t.id, "ERROR", meta.error); continue; }
  const renderSecs = Math.round((Date.now() - t0) / 1000);
  const pcm = Buffer.from(await evalJs("window.__tune.b64"), "base64"), hdr = Buffer.alloc(44);
  hdr.write("RIFF", 0); hdr.writeUInt32LE(36 + pcm.length, 4); hdr.write("WAVEfmt ", 8); hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20); hdr.writeUInt16LE(2, 22);
  hdr.writeUInt32LE(meta.rate, 24); hdr.writeUInt32LE(meta.rate * 4, 28); hdr.writeUInt16LE(4, 32); hdr.writeUInt16LE(16, 34); hdr.write("data", 36); hdr.writeUInt32LE(pcm.length, 40);
  const wav = join(musicDir, t.id + ".wav"); writeFileSync(wav, Buffer.concat([hdr, pcm]));
  const title = t.name.replace(/^[^A-Za-z]+/, "");
  execFileSync("lame", ["--quiet", "-V", "2", "--tt", title, "--ta", "Messed Up Dress Up", "--tl", "Messed Up Dress Up: the tunes", "--ty", day.slice(0, 4),
                        "--tc", `one loop at its default settings, ${day.replace(/\//g, "-")}`, wav, file]);
  unlinkSync(wav);
  out.push({ ...t, file: t.id + ".mp3", sameAsDay: null }); saveManifest();
  process.stdout.write(`\n${t.id} ${t.loopSecs}s rendered in ${renderSecs}s`);
}
// 4. the manifest and a page of players
saveManifest();
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const pageOf = (title, intro, rows) => `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title>
<style>body{font-family:sans-serif;margin:16px;max-width:820px;background:#faf8f3;color:#222} li{margin:10px 0;list-style:none} audio{width:100%;max-width:520px;display:block;margin-top:4px} small{color:#777} ul{padding:0}</style>
<h1>${esc(title)}</h1><p>${intro}</p><ul>${rows}</ul>`;
writeFileSync(join(musicDir, "index.html"), pageOf(`Dress Up's tunes, ${day}`, "Every tune at its default settings, one loop each. A tune unchanged since an earlier day plays that day's recording (noted). " +
  `<a href="${relative(musicDir, root)}/index.html">Every day</a>.` + (picturesUrl ? ` 🖼️ <a href="${picturesUrl}">The day's pictures</a>.` : ""),
  out.map(t => `<li><b>${esc(t.name)}</b> <small><code>${t.id}</code> · ${t.loopSecs} s a loop${t.sameAsDay ? ` · unchanged since ${t.sameAsDay}` : " · recorded today"}</small><audio controls preload="none" src="${t.real || t.file}"></audio></li>`).join("")));
// 5. a release: real copies, and a public page
if (release) {
  mkdirSync(release, { recursive: true });
  for (const t of out) copyFileSync(realpathSync(join(musicDir, t.file)), join(release, t.file));
  writeFileSync(join(release, "index.html"), pageOf("Messed Up Dress Up: the tunes",
    `Every tune in <a href="../">Messed Up Dress Up</a>, at its default settings, one loop each, as MP3s. In the game they play with each place, and the mixing board changes them as you like.`,
    out.map(t => `<li><b>${esc(t.name)}</b> <small>${t.loopSecs} s</small><audio controls preload="none" src="${t.file}"></audio></li>`).join("")));
}
console.log("\n" + out.filter(t => !t.sameAsDay).length, "tunes recorded,", out.filter(t => t.sameAsDay).length, "linked to an earlier day's recording");
process.exit(0);
