import type { SupabaseClient } from "@supabase/supabase-js";
import type { BracketPicks } from "./types";

export const RESULTS_ID = "wc2026";

// Load the single actual-results row and shape it like a user's bracket picks
// so the same resolve/score helpers work against it.
export async function fetchActualResults(
  supabase: SupabaseClient
): Promise<BracketPicks | null> {
  const { data } = await supabase
    .from("tournament_results")
    .select("group_standings, third_place_advance, match_winners")
    .eq("id", RESULTS_ID)
    .maybeSingle();
  if (!data) return null;
  return {
    groupStandings: (data.group_standings as BracketPicks["groupStandings"]) ?? {},
    thirdPlaceAdvance: (data.third_place_advance as string[]) ?? [],
    matchWinners: (data.match_winners as Record<string, string>) ?? {},
  };
}
