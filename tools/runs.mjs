// What the archive's tools share about a run: when it was made, in Mountain
// time ("Sat, Oct 17, 2026, 10:41 PM MDT"), and its git tag (a run
// YYYY/MM/DD[/HH-MM] is the tag run-YYYY-MM-DD[-HH-MM]).
export const when = src => { const t = src && src.made_at && new Date(src.made_at); return t && !isNaN(t) ? new Intl.DateTimeFormat("en-US", { timeZone: "America/Denver", weekday: "short", year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(t) : null; };
export const tagOf = run => "run-" + run.replace(/\//g, "-");
