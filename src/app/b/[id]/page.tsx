import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import Header from "@/components/Header";
import { GROUPS, MATCHES, FINAL_MATCH_ID, teamByCode } from "@/lib/tournament";
import {
  ROUND_LABEL,
  resolveSlot,
  slotLabel,
  type BracketPicks,
} from "@/lib/types";

export default async function PublicBracketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: bracket } = await supabase
    .from("brackets")
    .select("*, profiles!inner(username)")
    .eq("id", id)
    .eq("is_public", true)
    .maybeSingle();

  if (!bracket) notFound();

  const picks = (bracket.picks as BracketPicks) ?? {
    groupStandings: {},
    thirdPlaceAdvance: [],
    matchWinners: {},
  };
  const profile = (bracket as unknown as { profiles: { username: string } }).profiles;
  const champion = picks.matchWinners[FINAL_MATCH_ID] ? teamByCode(picks.matchWinners[FINAL_MATCH_ID]) : null;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      <Header signedIn={!!user} />

      <main className="container-page py-12">
        <div className="mb-10 border-b border-edge pb-8">
          <div className="eyebrow mb-3">@{profile.username}'s pick</div>
          <h1 className="display-xl text-cream">{bracket.name}</h1>

          {champion && (
            <div className="mt-6 inline-flex items-center gap-3 border border-pitch bg-pitch/10 px-5 py-3">
              <span className="eyebrow text-pitch">Predicted champion</span>
              <span className="text-2xl">{champion.flag}</span>
              <span className="font-display text-2xl uppercase tracking-wider text-cream">
                {champion.name}
              </span>
            </div>
          )}
        </div>

        {/* Group standings */}
        <section className="mb-12">
          <div className="eyebrow mb-3">Group stage predictions</div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {GROUPS.map((g) => {
              const order = picks.groupStandings[g.letter] ?? [];
              const advances = picks.thirdPlaceAdvance.includes(g.letter);
              return (
                <div key={g.letter} className="border border-edge bg-surface p-4">
                  <div className="mb-2 flex items-baseline justify-between">
                    <div className="display-md text-cream">Group {g.letter}</div>
                    {advances && (
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
                        return (
                          <li key={code} className="flex items-center gap-2 text-sm">
                            <span className="w-5 font-mono text-xs text-muted">
                              {i + 1}
                            </span>
                            <span>{t?.flag}</span>
                            <span className={i < 2 ? "text-cream" : i === 2 && advances ? "text-pitch" : "text-muted"}>
                              {t?.name}
                            </span>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Knockouts */}
        <section>
          <div className="eyebrow mb-3">Knockout predictions</div>
          <div className="overflow-x-auto">
            <div className="flex min-w-max gap-3">
              {(["R32", "R16", "QF", "SF", "F"] as const).map((round) => {
                const matches = MATCHES.filter((m) => m.round === round);
                return (
                  <div key={round} className="flex flex-col gap-2" style={{ minWidth: 240 }}>
                    <div className="border border-edge bg-surface px-3 py-2">
                      <div className="eyebrow">{ROUND_LABEL[round]}</div>
                    </div>
                    {matches.map((m) => {
                      const a = resolveSlot(m.slotA, picks);
                      const b = resolveSlot(m.slotB, picks);
                      const w = picks.matchWinners[m.id];
                      const teamA = a ? teamByCode(a) : null;
                      const teamB = b ? teamByCode(b) : null;
                      return (
                        <div key={m.id} className="border border-edge bg-ink">
                          <div className="border-b border-edge bg-surface px-3 py-1">
                            <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
                              {m.id}
                            </span>
                          </div>
                          <PublicSlotRow team={teamA} fallback={slotLabel(m.slotA)} isWinner={w === a && a !== null} isLoser={!!w && w !== a} />
                          <div className="border-t border-edge" />
                          <PublicSlotRow team={teamB} fallback={slotLabel(m.slotB)} isWinner={w === b && b !== null} isLoser={!!w && w !== b} />
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
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
  isWinner,
  isLoser,
}: {
  team: ReturnType<typeof teamByCode> | null;
  fallback: string;
  isWinner: boolean;
  isLoser: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between px-3 py-2 ${
        isWinner ? "bg-pitch text-ink" : isLoser ? "text-muted line-through decoration-sunset" : "text-cream"
      }`}
    >
      {team ? (
        <span className="flex items-center gap-2 text-sm">
          <span>{team.flag}</span>
          <span>{team.name}</span>
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
    </div>
  );
}
