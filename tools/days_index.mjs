// The front page of a dated archive (dress-up-pictures or dress-up-music):
// every day in it, newest first, each with the game version it recorded
// (from the day's source.json, written by archive-today.sh). Also days.json,
// the same list as data, for pages that show the newest day (the Dress Up
// pages under matthewhammer.org/hazel/dress-up/).
//   node days_index.mjs <archive root> <title> <intro html>
import { readdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const [root, title, intro] = process.argv.slice(2);
const days = [];
for (const y of readdirSync(root).filter(d => /^[0-9]{4}$/.test(d)))
  for (const m of readdirSync(join(root, y)).filter(d => /^[0-9]{2}$/.test(d)))
    for (const d of readdirSync(join(root, y, m)).filter(d => /^[0-9]{2}$/.test(d))) {
      const k = `${y}/${m}/${d}`;
      if (!existsSync(join(root, k, "index.html"))) continue;
      const src = existsSync(join(root, k, "source.json")) ? JSON.parse(readFileSync(join(root, k, "source.json"), "utf8")) : {};
      days.push({ k, src });
    }
days.sort((a, b) => b.k.localeCompare(a.k));
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
writeFileSync(join(root, "index.html"), `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title>
<style>body{font-family:sans-serif;margin:16px;max-width:820px;background:#faf8f3;color:#222} li{margin:8px 0} small{color:#777}</style>
<h1>${esc(title)}</h1><p>${intro}</p><ul>` +
  days.map(({ k, src }) => `<li><a href="${k}/index.html">${k}</a>` + (src.version ? ` <small>· Messed Up Dress Up ${esc(src.version)}` +
    (src.commit ? ` (<a href="https://github.com/matthewhammer/kids-choice-games/commit/${esc(src.commit)}">${esc(src.commit.slice(0, 7))}</a>)` : "") + `</small>` : "") + `</li>`).join("") +
  `</ul>`);
writeFileSync(join(root, "days.json"), JSON.stringify(days.map(({ k, src }) => ({ day: k, version: src.version ?? null, commit: src.commit ?? null, made_at: src.made_at ?? null })), null, 1) + "\n");
console.log(days.length, "days listed in", join(root, "index.html"));
