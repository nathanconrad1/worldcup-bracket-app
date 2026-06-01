import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BracketBuilder from "@/components/BracketBuilder";
import Header from "@/components/Header";
import { emptyPicks, type BracketPicks } from "@/lib/types";

export default async function BracketPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/");

  // Look up profile for username display
  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .single();

  // Get the user's primary bracket, or create one
  let { data: bracket } = await supabase
    .from("brackets")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!bracket) {
    const { data: created, error } = await supabase
      .from("brackets")
      .insert({
        user_id: user.id,
        name: `${profile?.username ?? "My"} Bracket`,
        picks: emptyPicks() as unknown as Record<string, unknown>,
      })
      .select()
      .single();
    if (error || !created) {
      throw new Error("Could not create bracket: " + (error?.message ?? "unknown"));
    }
    bracket = created;
  }

  const picks = (bracket.picks as BracketPicks) ?? emptyPicks();

  return (
    <>
      <Header signedIn={true} username={profile?.username} />
      <BracketBuilder
        userId={user.id}
        initialBracket={{
          id: bracket.id,
          name: bracket.name,
          picks,
        }}
      />
    </>
  );
}
