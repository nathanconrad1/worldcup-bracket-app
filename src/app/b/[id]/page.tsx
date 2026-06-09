import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import Header from "@/components/Header";
import { GROUPS, FINAL_MATCH_ID, orderedMatchesByRound, teamByCode } from "@/lib/tournament";
import {
  ROUND_LABEL,
  resolveSlot,
  slotLabel,
  type BracketPicks,
} from "@/lib/types";
import DragScroll from "@/components/DragScroll";
import { fetchActualResults } from "@/lib/results";
import {
  POINTS,
  actualAdvancersByRound,
  eliminatedTeams,
  hasAnyResults,
  knockoutSlotView,
  scoreBracket,
  type SlotView,
} from "@/lib/scoring";

export default async function PublicBracketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: bracket } = await supabase
    .from("brackets")
    .select("*")
    .eq("id", id)
    .eq("is_public", true)
    .maybeSingle();

  if (!bracket) notFound();

  // Look up the owner's username separately (no FK between brackets and profiles
  // for PostgREST to embed — both only reference auth.users).
  const { data: profileRow } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", bracket.user_id)
    .maybeSingle();
  const username = profileRow?.username ?? "anon";

  const picks = (bracket.picks as BracketPicks) ?? {
    groupStandings: {},
    thirdPlaceAdvance: [],
    matchWinners: {},
  };
  const champion = picks.matchWinners[FINAL_MATCH_ID] ? teamByCode(picks.matchWinners[FINAL_MATCH_ID]) : null;
  const ordered = orderedMatchesByRound();

  // Scored overlay against the real results
  const actual = await fetchActualResults(supabase);
  const scoringLive = hasAnyResults(actual);
  const eliminated = eliminatedTeams(actual);
  const advancers = actualAdvancersByRound(actual);
  const userAdvancers = actualAdvancersByRound(picks);
  const score = scoreBracket(picks, actual);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      <Header signedIn={!!user} />

      <main className="container-page py-12">
        <div className="mb-10 border-b border-edge pb-8">
          <div className="eyebrow mb-3">@{username}'s pick</div>
          <h1 className="display-xl text-cream">{bracket.name}</h1>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            {champion && (
              <div className="inline-flex items-center gap-3 border border-pitch bg-pitch/10 px-5 py-3">
                <span className="eyebrow text-pitch">Predicted champion</span>
                <span className="text-2xl">{champion.flag}</span>
                <span className="font-display text-2xl uppercase tracking-wider text-cream">
                  {champion.name}
                </span>
              </div>
            )}
            {scoringLive && (
              <div className="inline-flex items-center gap-3 border border-edge bg-surface px-5 py-3">
                <span className="eyebrow">Points</span>
                <span className="font-display text-2xl text-pitch">{score.total}</span>
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
                  {score.groupPoints} grp · {score.knockoutPoints} ko
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Group standings */}
        <section className="mb-12">
          <div className="eyebrow mb-3">Group stage predictions</div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {GROUPS.map((g) => {
              const order = picks.groupStandings[g.letter] ?? [];
              const advances = picks.thirdPlaceAdvance.includes(g.letter);
              const actualOrder = actual?.groupStandings[g.letter] ?? null;
              const scored = scoringLive && actualOrder?.length === 4;
              const correctCount = scored
                ? order.filter((code, i) => code && code === actualOrder![i]).length
                : 0;
              return (
                <div key={g.letter} className="border border-edge bg-surface p-4">
                  <div className="mb-2 flex items-baseline justify-between">
                    <div className="display-md text-cream">Group {g.letter}</div>
                    {scored ? (
                      <div className="font-mono text-[10px] uppercase tracking-widest">
                        <span className="text-pitch">+{correctCount}</span>
                        <span className="text-muted"> · {correctCount}/4</span>
                      </div>
                    ) : advances && (
                      <div className="font-mono text-[10px] uppercase tracking-widest text-pitch">
                        3rd advances
                      </div>
                    )}
                  </div>
                  {order.length === 0 ? (
                    <div className="font-mono text-xs text-muted">No picks yet</div>
                  ) : (
                    <ol className="space-y-1">
                      {order.map((code, i) => {
                        const t = teamByCode(code);
                        const isOut = scoringLive && eliminated.has(code);
                        const posCorrect = scored && actualOrder![i] === code;
                        return (
                          <li key={code} className="flex items-center gap-2 text-sm">
                            <span className="w-5 font-mono text-xs text-muted">
                              {i + 1}
                            </span>
                            <span>{t?.flag}</span>
                            <span
                              className={`${isOut ? "text-muted line-through decoration-sunset" : i < 2 ? "text-cream" : i === 2 && advances ? "text-pitch" : "text-muted"}`}
                            >
                              {t?.name}
                            </span>
                            {posCorrect && (
                              <span className="ml-auto font-mono text-[10px] uppercase tracking-widest text-pitch">
                                ✓ +1
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ol>
                  )}
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
            })}
          </div>
        </section>

        {/* Knockouts */}
        <section>
          <div className="eyebrow mb-3">Knockout predictions</div>
          <DragScroll>
            <div className="flex min-w-max items-stretch gap-3">
              {(["R32", "R16", "QF", "SF", "F"] as const).map((round) => {
                const matches = ordered[round] ?? [];
                return (
                  <div key={round} className="flex flex-col gap-2" style={{ minWidth: 240 }}>
                    <div className="border border-edge bg-surface px-3 py-2">
                      <div className="eyebrow">{ROUND_LABEL[round]}</div>
                    </div>
                    <div className="flex flex-1 flex-col">
                      {matches.map((m) => {
                        const a = resolveSlot(m.slotA, picks);
                        const b = resolveSlot(m.slotB, picks);
                        const w = picks.matchWinners[m.id] ?? null;
                        const teamA = a ? teamByCode(a) : null;
                        const teamB = b ? teamByCode(b) : null;
                        const actualWinnerHere = scoringLive && actual ? actual.matchWinners[m.id] ?? null : null;
                        const earned =
                          actualWinnerHere && userAdvancers[m.round].has(actualWinnerHere)
                            ? POINTS.round[m.round]
                            : 0;
                        const actualA = scoringLive && actual ? resolveSlot(m.slotA, actual) : null;
                        const actualB = scoringLive && actual ? resolveSlot(m.slotB, actual) : null;
                        const common = { round: m.round, eliminated, advancers, userAdvancers };
                        const viewA = knockoutSlotView({ ...common, pick: a, actualOccupant: actualA, isWinnerPick: w === a && a !== null });
                        const viewB = knockoutSlotView({ ...common, pick: b, actualOccupant: actualB, isWinnerPick: w === b && b !== null });
                        return (
                          <div key={m.id} className="flex flex-1 flex-col justify-center py-1.5">
                            <div className="border border-edge bg-ink">
                              <div className="flex items-center justify-between border-b border-edge bg-surface px-3 py-1">
                                <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
                                  {m.id}
                                </span>
                                {earned > 0 && (
                                  <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-pitch">
                                    +{earned}
                                  </span>
                                )}
                              </div>
                              <PublicSlotRow team={teamA} fallback={slotLabel(m.slotA)} scoringLive={scoringLive} isWinner={w === a && a !== null} isLoser={!!w && w !== a} view={viewA} />
                              <div className="border-t border-edge" />
                              <PublicSlotRow team={teamB} fallback={slotLabel(m.slotB)} scoringLive={scoringLive} isWinner={w === b && b !== null} isLoser={!!w && w !== b} view={viewB} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </DragScroll>
        </section>

        {!user && (
          <div className="mt-12 border border-pitch bg-pitch/5 p-6 text-center">
            <div className="display-md mb-2 text-cream">Make your own picks</div>
            <p className="mb-4 text-muted">Build your bracket in 5 minutes. It's free.</p>
            <Link
              href="/"
              className="inline-block bg-pitch px-6 py-3 font-mono text-xs uppercase tracking-widest text-ink hover:bg-cream"
            >
              Start a bracket →
            </Link>
          </div>
        )}
      </main>
    </>
  );
}

function PublicSlotRow({
  team,
  fallback,
  scoringLive,
  isWinner,
  isLoser,
  view,
}: {
  team: ReturnType<typeof teamByCode> | null;
  fallback: string;
  scoringLive: boolean;
  isWinner: boolean;
  isLoser: boolean;
  view: SlotView;
}) {
  const actualTeam = scoringLive && view.actualCode ? teamByCode(view.actualCode) : null;

  let bg: string;
  let nameClass = "";
  if (scoringLive) {
    bg = view.green ? "bg-pitch text-ink" : "text-cream";
    nameClass = view.struck
      ? "line-through decoration-sunset text-muted"
      : view.dim
      ? "text-muted opacity-80"
      : "";
  } else {
    bg = isWinner ? "bg-pitch text-ink" : isLoser ? "text-muted line-through decoration-sunset" : "text-cream";
  }

  return (
    <div className={`flex flex-col gap-0.5 px-3 py-2 ${bg}`}>
      {actualTeam && (
        <span className="flex items-center gap-1 font-mono text-[10px] text-muted">
          <span className="opacity-70">actual →</span>
          <span>{actualTeam.flag}</span>
          <span className="uppercase tracking-widest">{actualTeam.name}</span>
          {view.smallCheck && <span className="font-bold text-pitch">✓</span>}
        </span>
      )}
      <span className="flex items-center justify-between">
        {team ? (
          <span className="flex items-center gap-2 text-sm">
            <span>{team.flag}</span>
            <span className={nameClass}>{team.name}</span>
            {scoringLive && view.mainCheck && (
              <span title="Correct pick" className={`text-xs font-bold ${view.green ? "text-ink" : "text-pitch"}`}>
                ✓
              </span>
            )}
          </span>
        ) : (
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
            {fallback}
          </span>
        )}
        {team && (
          <span className="font-mono text-[10px] uppercase tracking-widest opacity-70">
            {team.code}
          </span>
        )}
      </span>
    </div>
  );
}
