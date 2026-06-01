import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import Header from "@/components/Header";
import { teamByCode } from "@/lib/tournament";

export default async function LeaderboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: brackets } = await supabase
    .from("brackets")
    .select("id, name, champion, updated_at, profiles!inner(username)")
    .eq("is_public", true)
    .order("updated_at", { ascending: false })
    .limit(100);

  type Row = {
    id: string;
    name: string;
    champion: string | null;
    updated_at: string;
    profiles: { username: string };
  };
  const rows = (brackets ?? []) as unknown as Row[];

  return (
    <>
      <Header signedIn={!!user} />
      <main className="container-page py-12">
        <div className="mb-10 flex flex-col gap-3 border-b border-edge pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="eyebrow mb-2">Public brackets</div>
            <h1 className="display-xl text-cream">The Field</h1>
          </div>
          <p className="max-w-md text-muted">
            Every bracket made by everyone. Once the tournament starts, scores will rank
            them — for now, browse who's picking who to lift the trophy.
          </p>
        </div>

        {rows.length === 0 ? (
          <div className="border border-edge bg-surface p-10 text-center">
            <div className="display-md mb-2 text-cream">No brackets yet</div>
            <p className="text-muted">Be the first to call it.</p>
          </div>
        ) : (
          <div className="overflow-hidden border border-edge">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface">
                  <th className="eyebrow px-4 py-3 text-left">User</th>
                  <th className="eyebrow px-4 py-3 text-left">Bracket</th>
                  <th className="eyebrow px-4 py-3 text-left">Champion</th>
                  <th className="eyebrow px-4 py-3 text-right">Updated</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const team = row.champion ? teamByCode(row.champion) : null;
                  return (
                    <tr
                      key={row.id}
                      className="border-t border-edge transition hover:bg-surface"
                    >
                      <td className="px-4 py-3 font-mono text-cream">
                        @{row.profiles.username}
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/b/${row.id}`} className="text-cream hover:text-pitch">
                          {row.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        {team ? (
                          <span className="flex items-center gap-2">
                            <span>{team.flag}</span>
                            <span className="font-medium text-cream">{team.name}</span>
                          </span>
                        ) : (
                          <span className="font-mono text-xs text-muted">In progress</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-muted">
                        {new Date(row.updated_at).toLocaleDateString()}
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
