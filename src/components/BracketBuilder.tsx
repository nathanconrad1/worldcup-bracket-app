"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { GROUPS, MATCHES, FINAL_MATCH_ID, THIRD_PLACE_MATCH_ID, teamByCode, type Match } from "@/lib/tournament";
import {
  ROUND_LABEL,
  countCompletedMatches,
  emptyPicks,
  getChampion,
  resolveSlot,
  slotLabel,
  type BracketPicks,
} from "@/lib/types";

type Props = {
  userId: string;
  initialBracket: {
    id: string;
    name: string;
    picks: BracketPicks;
  };
};

export default function BracketBuilder({ userId, initialBracket }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [picks, setPicks] = useState<BracketPicks>(initialBracket.picks);
  const [name, setName] = useState(initialBracket.name);
  const [tab, setTab] = useState<"groups" | "knockout">("groups");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [, startTransition] = useTransition();

  // Auto-save 1.2s after the last change
  useEffect(() => {
    if (saveStatus === "saving") return;
    const t = setTimeout(() => save(), 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picks, name]);

  async function save() {
    setSaveStatus("saving");
    const champion = getChampion(picks);
    const { error } = await supabase
      .from("brackets")
      .update({
        name,
        picks: picks as unknown as Record<string, unknown>,
        champion,
      })
      .eq("id", initialBracket.id)
      .eq("user_id", userId);

    if (error) {
      console.error(error);
      setSaveStatus("error");
    } else {
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 1500);
      startTransition(() => router.refresh());
    }
  }

  // === Group stage handlers ============================================
  function setGroupRanking(letter: string, ordered: string[]) {
    setPicks((p) => ({
      ...p,
      groupStandings: { ...p.groupStandings, [letter]: ordered },
      // Wipe any downstream knockout picks that referenced removed teams
      matchWinners: cleanupWinners({ ...p, groupStandings: { ...p.groupStandings, [letter]: ordered } }),
    }));
  }

  function toggleThirdPlaceAdvance(letter: string) {
    setPicks((p) => {
      const has = p.thirdPlaceAdvance.includes(letter);
      let next = has
        ? p.thirdPlaceAdvance.filter((x) => x !== letter)
        : [...p.thirdPlaceAdvance, letter];
      if (next.length > 8) next = next.slice(-8); // cap at 8
      const updated = { ...p, thirdPlaceAdvance: next };
      return { ...updated, matchWinners: cleanupWinners(updated) };
    });
  }

  // After mutating standings, drop any match winner that no longer resolves
  function cleanupWinners(state: BracketPicks): Record<string, string> {
    const valid: Record<string, string> = {};
    for (const m of MATCHES) {
      const w = state.matchWinners[m.id];
      if (!w) continue;
      const a = resolveSlot(m.slotA, state);
      const b = resolveSlot(m.slotB, state);
      if (w === a || w === b) valid[m.id] = w;
    }
    return valid;
  }

  function pickWinner(matchId: string, teamCode: string) {
    setPicks((p) => {
      const next = { ...p, matchWinners: { ...p.matchWinners, [matchId]: teamCode } };
      // Cascade: if downstream matches no longer resolve correctly, clean them up
      return { ...next, matchWinners: cleanupWinners(next) };
    });
  }

  // === Progress meters =================================================
  const groupsComplete = GROUPS.filter(
    (g) => (picks.groupStandings[g.letter] ?? []).length === 4
  ).length;

  const koComplete = countCompletedMatches(picks);
  const champion = getChampion(picks);

  return (
    <div className="container-page py-8 md:py-12">
      {/* Top row: name + status */}
      <div className="mb-6 flex flex-col gap-4 border-b border-edge pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex-1">
          <div className="eyebrow mb-2">Your bracket</div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-transparent font-display text-3xl uppercase tracking-wider text-cream outline-none focus:text-pitch sm:text-4xl md:text-5xl"
            maxLength={60}
          />
        </div>
        <div className="flex items-center gap-3">
          <SaveBadge status={saveStatus} />
          <ShareButton bracketId={initialBracket.id} />
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-8 grid grid-cols-1 gap-px overflow-hidden border border-edge sm:grid-cols-3">
        <Progress label="Group Stage"      value={groupsComplete} max={12} />
        <Progress label="Knockout Matches" value={koComplete} max={MATCHES.length} />
        <ChampionDisplay champion={champion} />
      </div>

      {/* Tabs */}
      <div className="mb-8 flex border border-edge">
        <TabBtn active={tab === "groups"}  onClick={() => setTab("groups")}>
          1 · Group Stage
        </TabBtn>
        <TabBtn active={tab === "knockout"} onClick={() => setTab("knockout")}>
          2 · Knockouts
        </TabBtn>
      </div>

      {tab === "groups" ? (
        <GroupStage
          picks={picks}
          onRank={setGroupRanking}
          onToggleThird={toggleThirdPlaceAdvance}
        />
      ) : (
        <KnockoutStage picks={picks} onPick={pickWinner} />
      )}
    </div>
  );
}

// =============================================================================
// Sub-components
// =============================================================================

function SaveBadge({ status }: { status: "idle" | "saving" | "saved" | "error" }) {
  const map = {
    idle:   { label: "● Auto-saved",     cls: "text-muted" },
    saving: { label: "◌ Saving…",        cls: "text-gold" },
    saved:  { label: "✓ Saved",          cls: "text-pitch" },
    error:  { label: "✕ Save failed",    cls: "text-sunset" },
  };
  const { label, cls } = map[status];
  return (
    <span className={`font-mono text-[10px] uppercase tracking-widest ${cls}`}>
      {label}
    </span>
  );
}

function ShareButton({ bracketId }: { bracketId: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    const url = `${window.location.origin}/b/${bracketId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <button
      onClick={copy}
      className="border border-edge bg-surface px-4 py-2 font-mono text-xs uppercase tracking-widest text-cream hover:border-pitch hover:text-pitch"
    >
      {copied ? "✓ Link copied" : "Share link"}
    </button>
  );
}

function Progress({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div className="bg-surface px-5 py-4">
      <div className="flex items-center justify-between">
        <span className="eyebrow">{label}</span>
        <span className="font-mono text-xs text-cream">
          {value}/{max}
        </span>
      </div>
      <div className="mt-3 h-1 w-full bg-edge">
        <div
          className="h-full bg-pitch transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function ChampionDisplay({ champion }: { champion: string | null }) {
  const team = champion ? teamByCode(champion) : null;
  return (
    <div className="bg-surface px-5 py-4">
      <div className="eyebrow">Your champion</div>
      {team ? (
        <div className="mt-2 flex items-center gap-2">
          <span className="text-2xl">{team.flag}</span>
          <span className="font-display text-xl uppercase tracking-wider text-pitch">
            {team.name}
          </span>
        </div>
      ) : (
        <div className="mt-2 font-mono text-xs text-muted">Pick all the way through the final</div>
      )}
    </div>
  );
}

function TabBtn({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 px-4 py-3 font-mono text-xs uppercase tracking-widest transition ${
        active ? "bg-cream text-ink" : "text-muted hover:text-cream"
      }`}
    >
      {children}
    </button>
  );
}

// =============================================================================
// Group stage UI
// =============================================================================

function GroupStage({
  picks,
  onRank,
  onToggleThird,
}: {
  picks: BracketPicks;
  onRank: (letter: string, ordered: string[]) => void;
  onToggleThird: (letter: string) => void;
}) {
  const thirdsSelected = picks.thirdPlaceAdvance.length;

  return (
    <div className="space-y-8">
      <div className="border border-edge bg-surface p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <div className="eyebrow mb-1">Step 1</div>
            <h2 className="display-md text-cream">Rank each group</h2>
          </div>
          <div className="font-mono text-xs text-muted">
            Click teams in order — 1st, 2nd, 3rd, 4th
          </div>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {GROUPS.map((g) => (
          <GroupCard
            key={g.letter}
            group={g}
            order={picks.groupStandings[g.letter] ?? []}
            onChange={(ordered) => onRank(g.letter, ordered)}
          />
        ))}
      </div>

      <div className="border border-edge bg-surface p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <div className="eyebrow mb-1">Step 2</div>
            <h2 className="display-md text-cream">Pick 8 third-place teams to advance</h2>
            <p className="mt-2 text-sm text-muted">
              Only 8 of the 12 third-placed teams reach the Round of 32. Pick the groups
              whose third place you think makes it through.
            </p>
          </div>
          <div className="font-mono text-xs">
            <span className={thirdsSelected === 8 ? "text-pitch" : "text-muted"}>
              {thirdsSelected}/8 selected
            </span>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
          {GROUPS.map((g) => {
            const standings = picks.groupStandings[g.letter] ?? [];
            const third = standings[2];
            const team = third ? teamByCode(third) : null;
            const selected = picks.thirdPlaceAdvance.includes(g.letter);
            const disabled = !third || (!selected && thirdsSelected >= 8);
            return (
              <button
                key={g.letter}
                onClick={() => team && onToggleThird(g.letter)}
                disabled={disabled}
                className={`team-pick border p-3 text-left transition ${
                  selected
                    ? "is-selected border-pitch bg-pitch text-ink"
                    : "border-edge bg-ink hover:border-cream"
                } ${disabled && !selected ? "cursor-not-allowed opacity-40" : ""}`}
              >
                <div className="font-mono text-[10px] uppercase tracking-widest opacity-70">
                  Group {g.letter} · 3rd
                </div>
                {team ? (
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-lg">{team.flag}</span>
                    <span className="font-display text-sm uppercase tracking-wider">
                      {team.code}
                    </span>
                  </div>
                ) : (
                  <div className="mt-1 font-mono text-xs opacity-60">Rank group first</div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function GroupCard({
  group,
  order,
  onChange,
}: {
  group: { letter: string; teams: { code: string; name: string; flag: string }[] };
  order: string[];
  onChange: (ordered: string[]) => void;
}) {
  function handleClick(code: string) {
    const idx = order.indexOf(code);
    if (idx >= 0) {
      // Already picked — remove and shift everything down
      onChange(order.filter((c) => c !== code));
    } else if (order.length < 4) {
      onChange([...order, code]);
    }
  }

  function reset() {
    onChange([]);
  }

  const isComplete = order.length === 4;
  const placeLabels = ["1st", "2nd", "3rd", "4th"];

  return (
    <div
      className={`border bg-surface p-5 transition ${
        isComplete ? "border-pitch" : "border-edge"
      }`}
    >
      <div className="mb-4 flex items-baseline justify-between">
        <div>
          <div className="eyebrow">Group</div>
          <div className="display-md text-cream">{group.letter}</div>
        </div>
        <div className="text-right">
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted">
            {order.length}/4 ranked
          </div>
          {order.length > 0 && (
            <button
              onClick={reset}
              className="mt-1 font-mono text-[10px] uppercase tracking-widest text-sunset hover:underline"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      <ul className="space-y-1.5">
        {group.teams.map((t) => {
          const placeIdx = order.indexOf(t.code);
          const isPicked = placeIdx >= 0;
          return (
            <li key={t.code}>
              <button
                onClick={() => handleClick(t.code)}
                className={`team-pick flex w-full items-center justify-between border px-3 py-2.5 text-left ${
                  isPicked
                    ? placeIdx === 0
                      ? "is-selected border-pitch bg-pitch text-ink"
                      : placeIdx === 1
                      ? "is-selected border-cream bg-cream text-ink"
                      : placeIdx === 2
                      ? "is-selected border-gold bg-gold text-ink"
                      : "border-edge bg-edge text-cream"
                    : "border-edge bg-ink text-cream hover:border-cream"
                }`}
              >
                <span className="flex items-center gap-3">
                  <span className="text-xl">{t.flag}</span>
                  <span className="font-medium">{t.name}</span>
                </span>
                <span className="font-mono text-xs uppercase tracking-widest">
                  {isPicked ? placeLabels[placeIdx] : "—"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// =============================================================================
// Knockout UI
// =============================================================================

function KnockoutStage({
  picks,
  onPick,
}: {
  picks: BracketPicks;
  onPick: (matchId: string, teamCode: string) => void;
}) {
  const rounds: Match["round"][] = ["R32", "R16", "QF", "SF", "F"];
  const matchesByRound = useMemo(() => {
    const map: Record<string, Match[]> = {};
    for (const m of MATCHES) {
      if (!map[m.round]) map[m.round] = [];
      map[m.round].push(m);
    }
    return map;
  }, []);

  // Are group standings filled in enough to start picking?
  const groupsRanked = GROUPS.every(
    (g) => (picks.groupStandings[g.letter] ?? []).length === 4
  );
  const thirdsPicked = picks.thirdPlaceAdvance.length === 8;

  if (!groupsRanked || !thirdsPicked) {
    return (
      <div className="border border-edge bg-surface p-8 text-center">
        <div className="display-md mb-3 text-sunset">Finish the group stage first</div>
        <p className="text-muted">
          Rank all 12 groups and pick your 8 advancing third-place teams to unlock the
          knockout bracket.
        </p>
      </div>
    );
  }

  const tpm = MATCHES.find((m) => m.id === THIRD_PLACE_MATCH_ID)!;

  return (
    <div className="space-y-8">
      <div className="overflow-x-auto">
        <div className="flex min-w-max items-stretch gap-3">
          {rounds.map((r) => (
            <div key={r} className="flex flex-col gap-3" style={{ minWidth: 280 }}>
              <div className="sticky top-0 z-10 border border-edge bg-surface px-3 py-2">
                <div className="eyebrow">{ROUND_LABEL[r]}</div>
                <div className="font-mono text-[10px] text-muted">
                  {(matchesByRound[r] ?? []).length} match
                  {(matchesByRound[r] ?? []).length === 1 ? "" : "es"}
                </div>
              </div>
              <div className="flex flex-1 flex-col justify-around gap-3">
                {(matchesByRound[r] ?? []).map((m) => (
                  <MatchCard key={m.id} match={m} picks={picks} onPick={onPick} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Third place playoff */}
      <div className="border border-edge bg-surface p-5">
        <div className="mb-4 flex items-baseline justify-between">
          <div>
            <div className="eyebrow">Bonus</div>
            <h3 className="display-md text-cream">Third Place Match</h3>
          </div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted">
            Losers of the semifinals
          </div>
        </div>
        <div className="max-w-md">
          <MatchCard match={tpm} picks={picks} onPick={onPick} />
        </div>
      </div>
    </div>
  );
}

function MatchCard({
  match,
  picks,
  onPick,
}: {
  match: Match;
  picks: BracketPicks;
  onPick: (matchId: string, teamCode: string) => void;
}) {
  const teamA = resolveSlot(match.slotA, picks);
  const teamB = resolveSlot(match.slotB, picks);
  const winner = picks.matchWinners[match.id];

  const isFinal = match.id === FINAL_MATCH_ID;

  return (
    <div
      className={`border bg-ink ${
        isFinal
          ? "border-pitch shadow-[0_0_0_1px_rgba(0,215,86,0.3)]"
          : "border-edge"
      }`}
    >
      <div className="flex items-center justify-between border-b border-edge bg-surface px-3 py-1.5">
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
          {match.id}
        </span>
        {isFinal && (
          <span className="font-mono text-[10px] uppercase tracking-widest text-pitch">
            Final
          </span>
        )}
      </div>
      <SlotRow
        teamCode={teamA}
        labelFallback={slotLabel(match.slotA)}
        isWinner={winner === teamA && teamA !== null}
        isLoser={winner !== null && winner !== teamA}
        onClick={() => teamA && onPick(match.id, teamA)}
      />
      <div className="border-t border-edge" />
      <SlotRow
        teamCode={teamB}
        labelFallback={slotLabel(match.slotB)}
        isWinner={winner === teamB && teamB !== null}
        isLoser={winner !== null && winner !== teamB}
        onClick={() => teamB && onPick(match.id, teamB)}
      />
    </div>
  );
}

function SlotRow({
  teamCode,
  labelFallback,
  isWinner,
  isLoser,
  onClick,
}: {
  teamCode: string | null;
  labelFallback: string;
  isWinner: boolean;
  isLoser: boolean;
  onClick: () => void;
}) {
  const team = teamCode ? teamByCode(teamCode) : null;
  const empty = !team;
  return (
    <button
      onClick={onClick}
      disabled={empty}
      className={`team-pick flex w-full items-center justify-between px-3 py-2.5 text-left transition ${
        isWinner
          ? "is-selected bg-pitch text-ink"
          : isLoser
          ? "is-eliminated text-muted"
          : "text-cream hover:bg-surface2"
      } ${empty ? "cursor-not-allowed" : ""}`}
    >
      {team ? (
        <span className="flex items-center gap-2.5">
          <span className="text-lg">{team.flag}</span>
          <span className="font-medium">{team.name}</span>
        </span>
      ) : (
        <span className="font-mono text-xs uppercase tracking-widest text-muted">
          {labelFallback}
        </span>
      )}
      {team && (
        <span className="font-mono text-[10px] uppercase tracking-widest opacity-70">
          {team.code}
        </span>
      )}
    </button>
  );
}
