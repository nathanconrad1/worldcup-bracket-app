import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import Header from "@/components/Header";
import { teamByCode } from "@/lib/tournament";
import type { BracketPicks } from "@/lib/types";
import { scoreBracket, hasAnyResults, type ScoreBreakdown } from "@/lib/scoring";
import { fetchActualResults } from "@/lib/results";

type DBBracket = {
  id: string;
  user_id: string;
  name: string;
  picks: BracketPicks;
  champion: string | null;
  created_at: string;
  updated_at: string;
};

export default async function LeaderboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Everyone registered, every public bracket, and the actual results — in parallel.
  const [{ data: profiles }, { data: brackets }, actual] = await Promise.all([
    supabase.from("profiles").select("id, username"),
    supabase
      .from("brackets")
      .select("id, user_id, name, picks, champion, created_at, updated_at")
      .eq("is_public", true),
    fetchActualResults(supabase),
  ]);

  const scoringLive = hasAnyResults(actual);

  // One bracket per user = their primary (earliest created), matching /bracket.
  const primary = new Map<string, DBBracket>();
  for (const b of (brackets ?? []) as unknown as DBBracket[]) {
    const cur = primary.get(b.user_id);
    if (!cur || new Date(b.created_at) < new Date(cur.created_at)) primary.set(b.user_id, b);
  }

  type Row = {
    userId: string;
    username: string;
    bracket: DBBracket | null;
    score: ScoreBreakdown | null;
  };
  const rows: Row[] = ((profiles ?? []) as { id: string; username: string }[]).map((p) => {
    const bracket = primary.get(p.id) ?? null;
    return {
      userId: p.id,
      username: p.username,
      bracket,
      score: bracket ? scoreBracket(bracket.picks, actual) : null,
    };
  });

  rows.sort((a, b) => {
    const sa = a.score?.total ?? 0;
    const sb = b.score?.total ?? 0;
    if (scoringLive && sa !== sb) return sb - sa;
    // Tiebreak: users with a bracket first, then most recently updated, then name.
    const ha = a.bracket ? 1 : 0;
    const hb = b.bracket ? 1 : 0;
    if (ha !== hb) return hb - ha;
    const ua = a.bracket ? new Date(a.bracket.updated_at).getTime() : 0;
    const ub = b.bracket ? new Date(b.bracket.updated_at).getTime() : 0;
    if (ua !== ub) return ub - ua;
    return a.username.localeCompare(b.username);
  });

  return (
    <>
      <Header signedIn={!!user} />
      <main className="container-page py-12">
        <div className="mb-10 flex flex-col gap-3 border-b border-edge pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="eyebrow mb-2">Everyone playing</div>
            <h1 className="display-xl text-cream">The Field</h1>
          </div>
          <p className="max-w-md text-muted">
            {scoringLive
              ? "Live standings — points update as results come in. 1 pt per correct group position, then 2/3/4/5/6 per correct knockout pick by round. Click anyone to see their bracket."
              : "Everyone who's registered. Once results start coming in, scores will rank the field — for now, browse who's picking who. Click anyone to see their bracket."}
          </p>
        </div>

        {rows.length === 0 ? (
          <div className="border border-edge bg-surface p-10 text-center">
            <div className="display-md mb-2 text-cream">No players yet</div>
            <p className="text-muted">Be the first to call it.</p>
          </div>
        ) : (
          <div className="overflow-hidden border border-edge">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface">
                  <th className="eyebrow px-4 py-3 text-left">#</th>
                  <th className="eyebrow px-4 py-3 text-left">User</th>
                  <th className="eyebrow px-4 py-3 text-left">Bracket</th>
                  <th className="eyebrow px-4 py-3 text-left">Champion</th>
                  <th className="eyebrow px-4 py-3 text-right">
                    {scoringLive ? "Points" : "Status"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const b = row.bracket;
                  const team = b?.champion ? teamByCode(b.champion) : null;
                  const href = b ? `/b/${b.id}` : null;
                  const isMe = row.userId === user?.id;
                  return (
                    <tr
                      key={row.userId}
                      className={`border-t border-edge transition hover:bg-surface ${
                        isMe ? "bg-pitch/5" : ""
                      }`}
                    >
                      <td className="px-4 py-3 font-mono text-muted">{i + 1}</td>
                      <td className="px-4 py-3">
                        {href ? (
                          <Link href={href} className="font-mono text-cream hover:text-pitch">
                            @{row.username}
                          </Link>
                        ) : (
                          <span className="font-mono text-cream">@{row.username}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {href ? (
                          <Link href={href} className="text-cream hover:text-pitch">
                            {b!.name}
                          </Link>
                        ) : (
                          <span className="font-mono text-xs text-muted">No bracket yet</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {team ? (
                          <span className="flex items-center gap-2">
                            <span>{team.flag}</span>
                            <span className="font-medium text-cream">{team.name}</span>
                          </span>
                        ) : (
                          <span className="font-mono text-xs text-muted">
                            {b ? "In progress" : "—"}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {scoringLive ? (
                          <>
                            <span className="font-display text-xl text-pitch">
                              {row.score?.total ?? 0}
                            </span>
                            {row.score && (
                              <span className="ml-2 font-mono text-[10px] uppercase tracking-widest text-muted">
                                {row.score.correctPositions}grp · {row.score.correctMatches}ko
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="font-mono text-xs text-muted">
                            {b ? new Date(b.updated_at).toLocaleDateString() : "Not started"}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
