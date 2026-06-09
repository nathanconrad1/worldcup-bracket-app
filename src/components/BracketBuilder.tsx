"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { GROUPS, MATCHES, FINAL_MATCH_ID, THIRD_PLACE_MATCH_ID, orderedMatchesByRound, teamByCode, type Match } from "@/lib/tournament";
import DragScroll from "@/components/DragScroll";
import {
  ROUND_LABEL,
  countCompletedMatches,
  emptyPicks,
  getChampion,
  resolveSlot,
  slotLabel,
  type BracketPicks,
} from "@/lib/types";
import {
  POINTS,
  actualAdvancersByRound,
  eliminatedTeams,
  hasAnyResults,
  knockoutSlotView,
  type SlotView,
} from "@/lib/scoring";

type Props = {
  userId: string;
  actual: BracketPicks | null;
  initialBracket: {
    id: string;
    name: string;
    picks: BracketPicks;
  };
};

export default function BracketBuilder({ userId, actual, initialBracket }: Props) {
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
      const nextWinners = { ...p.matchWinners };
      if (nextWinners[matchId] === teamCode) {
        // Clicking the already-selected team clears the pick (toggle off)
        delete nextWinners[matchId];
      } else {
        nextWinners[matchId] = teamCode;
      }
      const next = { ...p, matchWinners: nextWinners };
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

  // Scored overlay state (only active once real results start arriving)
  const scoringLive = hasAnyResults(actual);
  const eliminated = useMemo(() => eliminatedTeams(actual), [actual]);

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

      {scoringLive && (
        <div className="mb-6 flex flex-wrap items-center gap-x-5 gap-y-2 border border-edge bg-surface px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted">
          <span className="text-cream">Scoring is live</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 bg-pitch" /> Your pick still in</span>
          <span className="flex items-center gap-1.5"><span className="text-pitch">✓</span> Won its match</span>
          <span className="flex items-center gap-1.5"><span className="text-sunset line-through">Aa</span> Eliminated</span>
          <span className="flex items-center gap-1.5"><span className="text-pitch">+N</span> Points earned</span>
        </div>
      )}

      {tab === "groups" ? (
        <GroupStage
          picks={picks}
          actual={actual}
          scoringLive={scoringLive}
          eliminated={eliminated}
          onRank={setGroupRanking}
          onToggleThird={toggleThirdPlaceAdvance}
        />
      ) : (
        <KnockoutStage
          picks={picks}
          actual={actual}
          scoringLive={scoringLive}
          eliminated={eliminated}
          onPick={pickWinner}
        />
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
  actual,
  scoringLive,
  eliminated,
  onRank,
  onToggleThird,
}: {
  picks: BracketPicks;
  actual: BracketPicks | null;
  scoringLive: boolean;
  eliminated: Set<string>;
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
            actualOrder={actual?.groupStandings[g.letter] ?? null}
            scoringLive={scoringLive}
            eliminated={eliminated}
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
  actualOrder,
  scoringLive,
  eliminated,
  onChange,
}: {
  group: { letter: string; teams: { code: string; name: string; flag: string }[] };
  order: string[];
  actualOrder: string[] | null;
  scoringLive: boolean;
  eliminated: Set<string>;
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

  // Group score: +1 per position predicted correctly (once the group is final).
  const scored = scoringLive && actualOrder && actualOrder.length === 4;
  const correctCount = scored
    ? order.filter((code, i) => code && code === actualOrder![i]).length
    : 0;

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
          {scored ? (
            <div className="font-mono text-[10px] uppercase tracking-widest">
              <span className="text-pitch">+{correctCount}</span>
              <span className="text-muted"> · {correctCount}/4 correct</span>
            </div>
          ) : (
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted">
              {order.length}/4 ranked
            </div>
          )}
          {order.length > 0 && !scored && (
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
          const isOut = scoringLive && eliminated.has(t.code);
          const posCorrect = scored && placeIdx >= 0 && actualOrder![placeIdx] === t.code;
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
                  <span className={`font-medium ${isOut ? "line-through decoration-sunset opacity-70" : ""}`}>
                    {t.name}
                  </span>
                </span>
                <span className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest">
                  {scored && (posCorrect
                    ? <span className={placeIdx <= 2 ? "text-ink/70" : "text-pitch"}>✓ +1</span>
                    : isPicked && <span className="text-sunset">✗</span>)}
                  <span>{isPicked ? placeLabels[placeIdx] : "—"}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {scored && (
        <div className="mt-3 border-t border-edge pt-2.5">
          <div className="eyebrow mb-1.5">Actual finish</div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px] text-muted">
            {actualOrder!.map((code, i) => {
              const t = teamByCode(code);
              return (
                <span key={code} className="flex items-center gap-1">
                  <span className="opacity-60">{i + 1}</span>
                  <span>{t?.flag}</span>
                  <span className="uppercase tracking-widest">{code}</span>
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Knockout UI
// =============================================================================

function KnockoutStage({
  picks,
  actual,
  scoringLive,
  eliminated,
  onPick,
}: {
  picks: BracketPicks;
  actual: BracketPicks | null;
  scoringLive: boolean;
  eliminated: Set<string>;
  onPick: (matchId: string, teamCode: string) => void;
}) {
  const rounds: Match["round"][] = ["R32", "R16", "QF", "SF", "F"];
  const matchesByRound = useMemo(() => orderedMatchesByRound(), []);
  const advancers = useMemo(() => actualAdvancersByRound(actual), [actual]);
  const userAdvancers = useMemo(() => actualAdvancersByRound(picks), [picks]);

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
      <DragScroll>
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
              {/* Equal-height cells per round → each later-round match centers
                  between the two matches that feed it, so columns line up. */}
              <div className="flex flex-1 flex-col">
                {(matchesByRound[r] ?? []).map((m) => (
                  <div key={m.id} className="flex flex-1 flex-col justify-center py-2">
                    <MatchCard
                      match={m}
                      picks={picks}
                      actual={actual}
                      advancers={advancers}
                      userAdvancers={userAdvancers}
                      scoringLive={scoringLive}
                      eliminated={eliminated}
                      onPick={onPick}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DragScroll>

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
          <MatchCard
            match={tpm}
            picks={picks}
            actual={actual}
            advancers={advancers}
            userAdvancers={userAdvancers}
            scoringLive={scoringLive}
            eliminated={eliminated}
            onPick={onPick}
          />
        </div>
      </div>
    </div>
  );
}

function MatchCard({
  match,
  picks,
  actual,
  advancers,
  userAdvancers,
  scoringLive,
  eliminated,
  onPick,
}: {
  match: Match;
  picks: BracketPicks;
  actual: BracketPicks | null;
  advancers: Record<Match["round"], Set<string>>;
  userAdvancers: Record<Match["round"], Set<string>>;
  scoringLive: boolean;
  eliminated: Set<string>;
  onPick: (matchId: string, teamCode: string) => void;
}) {
  const teamA = resolveSlot(match.slotA, picks);
  const teamB = resolveSlot(match.slotB, picks);
  const winner = picks.matchWinners[match.id] ?? null;

  const isFinal = match.id === FINAL_MATCH_ID;

  // Who ACTUALLY belongs in each slot.
  const actualA = scoringLive && actual ? resolveSlot(match.slotA, actual) : null;
  const actualB = scoringLive && actual ? resolveSlot(match.slotB, actual) : null;

  const common = {
    round: match.round,
    eliminated,
    advancers,
    userAdvancers,
  };
  const viewA = knockoutSlotView({ ...common, pick: teamA, actualOccupant: actualA, isWinnerPick: winner === teamA && teamA !== null });
  const viewB = knockoutSlotView({ ...common, pick: teamB, actualOccupant: actualB, isWinnerPick: winner === teamB && teamB !== null });

  // Points ride on the ACTUAL match (same card as the ✓): if the real winner of
  // this fixture is a team you correctly advanced this round, you earned the points.
  const actualWinnerHere = scoringLive && actual ? actual.matchWinners[match.id] ?? null : null;
  const earned =
    actualWinnerHere && userAdvancers[match.round].has(actualWinnerHere)
      ? POINTS.round[match.round]
      : 0;

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
        {earned > 0 ? (
          <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-pitch">
            +{earned}
          </span>
        ) : (
          isFinal && (
            <span className="font-mono text-[10px] uppercase tracking-widest text-pitch">
              Final
            </span>
          )
        )}
      </div>
      <SlotRow
        teamCode={teamA}
        labelFallback={slotLabel(match.slotA)}
        scoringLive={scoringLive}
        isWinner={winner === teamA && teamA !== null}
        isLoser={winner !== null && winner !== teamA}
        view={viewA}
        onClick={() => teamA && onPick(match.id, teamA)}
      />
      <div className="border-t border-edge" />
      <SlotRow
        teamCode={teamB}
        labelFallback={slotLabel(match.slotB)}
        scoringLive={scoringLive}
        isWinner={winner === teamB && teamB !== null}
        isLoser={winner !== null && winner !== teamB}
        view={viewB}
        onClick={() => teamB && onPick(match.id, teamB)}
      />
    </div>
  );
}

function SlotRow({
  teamCode,
  labelFallback,
  scoringLive,
  isWinner,
  isLoser,
  view,
  onClick,
}: {
  teamCode: string | null;
  labelFallback: string;
  scoringLive: boolean;
  isWinner: boolean;
  isLoser: boolean;
  view: SlotView;
  onClick: () => void;
}) {
  const team = teamCode ? teamByCode(teamCode) : null;
  const empty = !team;
  const actualTeam = scoringLive && view.actualCode ? teamByCode(view.actualCode) : null;

  // Button background + name treatment. Before any results, fall back to the
  // plain prediction styling (your pick highlighted, predicted loser muted).
  let buttonClass: string;
  let nameClass = "";
  if (scoringLive) {
    buttonClass = view.green ? "bg-pitch text-ink" : "text-cream hover:bg-surface2";
    nameClass = view.struck
      ? "line-through decoration-sunset text-muted"
      : view.dim
      ? "text-muted opacity-80"
      : "";
  } else {
    buttonClass = isWinner
      ? "is-selected bg-pitch text-ink"
      : isLoser
      ? "is-eliminated text-muted"
      : "text-cream hover:bg-surface2";
  }

  return (
    <button
      onClick={onClick}
      disabled={empty}
      className={`team-pick flex w-full flex-col gap-0.5 px-3 py-2 text-left transition ${buttonClass} ${
        empty ? "cursor-not-allowed" : ""
      }`}
    >
      {/* Small "actual → real team" line when your pick wasn't who really got here.
          The ✓ rides here when you correctly called this team's run but mis-slotted it. */}
      {scoringLive && actualTeam && (
        <span className="flex items-center gap-1 font-mono text-[10px] text-muted">
          <span className="opacity-70">actual →</span>
          <span>{actualTeam.flag}</span>
          <span className="uppercase tracking-widest">{actualTeam.name}</span>
          {view.smallCheck && <span className="font-bold text-pitch">✓</span>}
        </span>
      )}
      <span className="flex w-full items-center justify-between">
        {team ? (
          <span className="flex items-center gap-2.5">
            <span className="text-lg">{team.flag}</span>
            <span className={`font-medium ${nameClass}`}>{team.name}</span>
            {scoringLive && view.mainCheck && (
              <span
                title="Correct pick"
                className={`font-mono text-xs font-bold ${view.green ? "text-ink" : "text-pitch"}`}
              >
                ✓
              </span>
            )}
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
      </span>
    </button>
  );
}
