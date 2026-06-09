#!/usr/bin/env node
// Enter ACTUAL tournament results into Supabase (the `tournament_results` row).
// Run from the project root. Requires NEXT_PUBLIC_SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY in .env.local (the service-role key bypasses RLS).
//
// Usage:
//   node scripts/enter-result.mjs show
//   node scripts/enter-result.mjs group A MEX KOR RSA CZE      # final standings 1st→4th
//   node scripts/enter-result.mjs thirds A C D F G I J L       # the 8 groups whose 3rd advanced
//   node scripts/enter-result.mjs match M73 BRA                # winner of fixture M73
//   node scripts/enter-result.mjs unset-match M73             # clear a match result
//   node scripts/enter-result.mjs lock 2026-06-11T19:00:00Z   # freeze all bracket edits at this time
//   node scripts/enter-result.mjs lock off                    # re-open editing (clear the lock)
//
// Match ids are the official fixture numbers M73–M104 (see src/lib/tournament.ts).

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const RESULTS_ID = "wc2026";

// ---- load .env.local -------------------------------------------------------
function loadEnv() {
  let txt = "";
  try {
    txt = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  } catch {
    txt = "";
  }
  const env = { ...process.env };
  for (const line of txt.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

// ---- parse valid teams / groups / matches from tournament.ts ---------------
function loadTournamentRefs() {
  const src = readFileSync(new URL("../src/lib/tournament.ts", import.meta.url), "utf8");
  const teamCodes = new Set([...src.matchAll(/code:\s*"([A-Z]{3})"/g)].map((m) => m[1]));
  const groups = new Set([...src.matchAll(/letter:\s*"([A-L])"/g)].map((m) => m[1]));
  const matchIds = new Set([...src.matchAll(/id:\s*"(M\d+)"/g)].map((m) => m[1]));
  return { teamCodes, groups, matchIds };
}

function die(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

const env = loadEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url) die("NEXT_PUBLIC_SUPABASE_URL is not set in .env.local");
if (!serviceKey) {
  die(
    "SUPABASE_SERVICE_ROLE_KEY is not set in .env.local.\n" +
      "  Get it from: Supabase Dashboard → Project Settings → API → service_role (secret).\n" +
      "  Add a line:  SUPABASE_SERVICE_ROLE_KEY=...  (this key is server-only — never commit it)."
  );
}

const refs = loadTournamentRefs();
const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

async function getRow() {
  const { data, error } = await supabase
    .from("tournament_results")
    .select("group_standings, third_place_advance, match_winners, picks_lock_at")
    .eq("id", RESULTS_ID)
    .maybeSingle();
  if (error) die(error.message);
  return (
    data ?? { group_standings: {}, third_place_advance: [], match_winners: {}, picks_lock_at: null }
  );
}

async function save(patch) {
  const { error } = await supabase
    .from("tournament_results")
    .upsert({ id: RESULTS_ID, ...patch });
  if (error) die(error.message);
}

const [cmd, ...args] = process.argv.slice(2);

if (cmd === "show" || !cmd) {
  const row = await getRow();
  console.log(JSON.stringify(row, null, 2));
  const mw = row.match_winners ?? {};
  const gs = row.group_standings ?? {};
  const lock = row.picks_lock_at
    ? `picks lock at ${row.picks_lock_at} (${new Date(row.picks_lock_at) > new Date() ? "open until then" : "LOCKED"})`
    : "picks open (no lock set)";
  console.log(
    `\n${Object.keys(gs).length} group(s) set · ${Object.keys(mw).length} match result(s) set · ${lock}`
  );
} else if (cmd === "group") {
  const [letter, ...teams] = args;
  if (!refs.groups.has(letter)) die(`Unknown group "${letter}" (expected A–L)`);
  if (teams.length !== 4) die(`Group needs exactly 4 teams (1st→4th); got ${teams.length}`);
  for (const t of teams) if (!refs.teamCodes.has(t)) die(`Unknown team code "${t}"`);
  const row = await getRow();
  const next = { ...(row.group_standings ?? {}), [letter]: teams };
  await save({ group_standings: next });
  console.log(`✓ Group ${letter} standings set: ${teams.join(" > ")}`);
} else if (cmd === "thirds") {
  const groups = args;
  if (groups.length !== 8) die(`Expected 8 group letters; got ${groups.length}`);
  for (const g of groups) if (!refs.groups.has(g)) die(`Unknown group "${g}"`);
  await save({ third_place_advance: [...groups].sort() });
  console.log(`✓ Advancing third-placed groups: ${[...groups].sort().join(", ")}`);
} else if (cmd === "match") {
  const [matchId, team] = args;
  if (!refs.matchIds.has(matchId)) die(`Unknown match id "${matchId}" (expected M73–M104)`);
  if (!refs.teamCodes.has(team)) die(`Unknown team code "${team}"`);
  const row = await getRow();
  const next = { ...(row.match_winners ?? {}), [matchId]: team };
  await save({ match_winners: next });
  console.log(`✓ ${matchId} winner set: ${team}`);
} else if (cmd === "unset-match") {
  const [matchId] = args;
  const row = await getRow();
  const next = { ...(row.match_winners ?? {}) };
  delete next[matchId];
  await save({ match_winners: next });
  console.log(`✓ ${matchId} result cleared`);
} else if (cmd === "lock") {
  const [when] = args;
  if (when === "off" || when === "clear" || when === "none") {
    await save({ picks_lock_at: null });
    console.log("✓ Picks unlocked — editing is open (no lock time).");
  } else {
    const d = new Date(when);
    if (!when || isNaN(d.getTime())) {
      die(`Invalid datetime "${when ?? ""}". Use ISO 8601, e.g. 2026-06-11T19:00:00Z (or "off").`);
    }
    await save({ picks_lock_at: d.toISOString() });
    console.log(`✓ Picks lock set to ${d.toISOString()} (your local: ${d.toLocaleString()}).`);
  }
} else {
  die(`Unknown command "${cmd}". Use: show | group | thirds | match | unset-match | lock`);
}
