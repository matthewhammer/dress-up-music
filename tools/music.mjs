// The music for one run of the Dress Up archive: every tune, at its default
// settings, for one loop (and a short tail for its echoes), as an MP3,
// music/<tune id>.mp3, with a manifest and a page of players (the archive
// is its own repository, matthewhammer/dress-up-music).
// (2026-10-18, Matthew: "only one copy per song") Every run writes the same
// folder, music/; git keeps the runs before, each a tag. A tune whose
// fingerprint (its notes, sections, tempo and levels, the code of every
// instrument it uses, and the player's and mixer's code) matches the run
// before keeps that run's file, untouched, and its "recordedIn" run; only a
// new or changed tune is rendered. A tune gone from the game goes from the
// folder. A tune that fails to render keeps its last recording, noted, so a
// failure never loses one. With a release folder, the run's MP3s are also
// copied there with a public page listing them.
//   node music.mjs <devtools port> <page url> <archive root> <run: YYYY/MM/DD[/HH-MM]> [source.json] [release dir]
// (source.json: the game's version and commit, and when and where the run was made; copied into music/)
import { writeFileSync, mkdirSync, readFileSync, existsSync, readdirSync, copyFileSync, unlinkSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { musicPage } from "./music_page.mjs";
const [dport, url, root, run, sourceFile, release] = process.argv.slice(2);
if (!run) { console.log("usage: node music.mjs <devtools port> <page url> <archive root> <run> [source.json] [release dir]"); process.exit(1); }
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
// 2. the run before: its manifest, in the same folder (a run that stopped part way left its own, which
// counts the same way: a tune whose fingerprint still matches keeps its file, so a re-run resumes)
const musicDir = join(root, "music"), mf = join(musicDir, "manifest.json");
mkdirSync(musicDir, { recursive: true });
const before = new Map();
if (existsSync(mf)) for (const m of JSON.parse(readFileSync(mf, "utf8"))) before.set(m.id, m);
// (a file that is there and not empty: a crash once left a 0-byte MP3 listed in the manifest)
const has = f => { try { return statSync(f).size > 0; } catch (_) { return false; } };
// 3. each tune: kept from the run before, or a new render
const out = [], saveManifest = () => writeFileSync(mf, JSON.stringify(out, null, 1) + "\n");
for (const t of tunes) {
  const file = join(musicDir, t.id + ".mp3"), had = before.get(t.id);
  if (had && had.fingerprint === t.fingerprint && has(file)) { out.push({ ...t, file: t.id + ".mp3", recordedIn: had.recordedIn }); saveManifest(); process.stdout.write("="); continue; }
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
  const failed = !meta ? "TIMED OUT after 20 min" : JSON.parse(meta).error ? "ERROR " + JSON.parse(meta).error : null;
  if (failed) { console.log("\n" + t.id, failed);
    if (had && has(file)) { out.push({ ...had, failedIn: run }); saveManifest(); }
    continue; }
  meta = JSON.parse(meta);
  const renderSecs = Math.round((Date.now() - t0) / 1000);
  const pcm = Buffer.from(await evalJs("window.__tune.b64"), "base64"), hdr = Buffer.alloc(44);
  hdr.write("RIFF", 0); hdr.writeUInt32LE(36 + pcm.length, 4); hdr.write("WAVEfmt ", 8); hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20); hdr.writeUInt16LE(2, 22);
  hdr.writeUInt32LE(meta.rate, 24); hdr.writeUInt32LE(meta.rate * 4, 28); hdr.writeUInt16LE(4, 32); hdr.writeUInt16LE(16, 34); hdr.write("data", 36); hdr.writeUInt32LE(pcm.length, 40);
  const wav = join(musicDir, t.id + ".wav"); writeFileSync(wav, Buffer.concat([hdr, pcm]));
  const title = t.name.replace(/^[^A-Za-z]+/, "");
  execFileSync("lame", ["--quiet", "-V", "2", "--tt", title, "--ta", "Messed Up Dress Up", "--tl", "Messed Up Dress Up: the tunes", "--ty", run.slice(0, 4),
                        "--tc", `one loop at its default settings, ${run.replace(/\//g, "-")}`, wav, file]);
  unlinkSync(wav);
  out.push({ ...t, file: t.id + ".mp3", recordedIn: run }); saveManifest();
  process.stdout.write(`\n${t.id} ${t.loopSecs}s rendered in ${renderSecs}s`);
}
// 4. a tune gone from the game goes from the folder; the manifest, the run's source, a page of players
const kept = new Set(out.map(t => t.file));
for (const f of readdirSync(musicDir)) if (/\.(mp3|wav)$/.test(f) && !kept.has(f)) { unlinkSync(join(musicDir, f)); console.log("\nremoved", f); }
saveManifest();
const source = sourceFile ? JSON.parse(readFileSync(sourceFile, "utf8")) : existsSync(join(musicDir, "source.json")) ? JSON.parse(readFileSync(join(musicDir, "source.json"), "utf8")) : {};
if (sourceFile) writeFileSync(join(musicDir, "source.json"), JSON.stringify(source, null, 1) + "\n");
writeFileSync(join(musicDir, "index.html"), musicPage(out, source, run));
// 5. a release: copies, and a public page
if (release) {
  mkdirSync(release, { recursive: true });
  for (const t of out) copyFileSync(join(musicDir, t.file), join(release, t.file));
  writeFileSync(join(release, "index.html"), musicPage(out, source, run, { release: true }));
}
console.log("\n" + out.filter(t => t.recordedIn === run).length, "tunes recorded,", out.filter(t => t.recordedIn !== run && !t.failedIn).length, "kept from an earlier run,",
  out.filter(t => t.failedIn).length, "failed (their last recording kept),", tunes.length - out.length, "failed with none to keep");
process.exit(0);
