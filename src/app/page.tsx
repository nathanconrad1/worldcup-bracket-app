import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import AuthForm from "@/components/AuthForm";
import Header from "@/components/Header";
import { GROUPS } from "@/lib/tournament";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/bracket");

  const allTeams = GROUPS.flatMap((g) => g.teams);

  return (
    <>
      <Header signedIn={false} />

      <main className="relative overflow-hidden">
        {/* Hero */}
        <section className="container-page relative pb-20 pt-16 md:pb-32 md:pt-24">
          <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr] lg:gap-16">
            <div className="fade-up" style={{ animationDelay: "0.05s" }}>
              <div className="eyebrow mb-6 flex items-center gap-3">
                <span className="inline-block h-2 w-2 animate-pulse bg-pitch" />
                June 11 — July 19 · 2026
              </div>

              <h1 className="display-xl text-cream">
                Forty&nbsp;eight teams.
                <br />
                <span className="text-pitch">One bracket.</span>
                <br />
                Your call.
              </h1>

              <p className="mt-8 max-w-xl text-lg text-muted md:text-xl">
                Predict every match of the first 48-team World Cup — from the group stage
                to the final at MetLife Stadium. Save your bracket, share it with friends,
                and see who has the sharpest eye.
              </p>

              <div className="mt-10 flex flex-wrap items-center gap-x-10 gap-y-4 border-y border-edge py-6">
                <Stat value="48" label="Teams" />
                <Stat value="12" label="Groups" />
                <Stat value="104" label="Matches" />
                <Stat value="32" label="Knockout teams" accent />
              </div>
            </div>

            {/* Auth card */}
            <div
              className="fade-up relative border border-edge bg-surface p-8"
              style={{ animationDelay: "0.2s" }}
            >
              <div className="absolute -left-px -top-px h-12 w-12 border-l-2 border-t-2 border-pitch" />
              <div className="absolute -bottom-px -right-px h-12 w-12 border-b-2 border-r-2 border-pitch" />

              <div className="eyebrow mb-2">Get started</div>
              <h2 className="display-md mb-6 text-cream">Make your picks</h2>
              <AuthForm />
              <p className="mt-6 font-mono text-[10px] uppercase tracking-widest text-muted">
                Free forever · No spam · Your bracket stays private until you share it
              </p>
            </div>
          </div>
        </section>

        {/* Marquee of all 48 flags */}
        <section className="border-y border-edge bg-surface py-6">
          <div className="overflow-hidden">
            <div className="marquee">
              {[...allTeams, ...allTeams].map((t, i) => (
                <div
                  key={`${t.code}-${i}`}
                  className="flex shrink-0 items-center gap-3 px-6 font-mono text-sm text-cream"
                >
                  <span className="text-2xl">{t.flag}</span>
                  <span className="uppercase tracking-widest">{t.name}</span>
                  <span className="text-muted">·</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="container-page py-20 md:py-28">
          <div className="grid gap-2 md:grid-cols-3">
            <Step
              num="01"
              title="Predict every group"
              desc="Rank all four teams in each of the 12 groups. Top two automatically advance, plus the eight best third-placed teams."
            />
            <Step
              num="02"
              title="Build the knockouts"
              desc="Click your way through the Round of 32, Round of 16, quarters, semis — all the way to the final."
            />
            <Step
              num="03"
              title="Share & compete"
              desc="Save to your account, share a public link with friends, and see who called it best on the leaderboard."
            />
          </div>
        </section>

        {/* Group preview */}
        <section className="container-page pb-24">
          <div className="mb-8 flex items-end justify-between">
            <div>
              <div className="eyebrow mb-2">Group stage</div>
              <h2 className="display-lg text-cream">The draw</h2>
            </div>
            <Link href="#" className="font-mono text-xs uppercase tracking-widest text-pitch">
              Sign up to predict ↗
            </Link>
          </div>
          <div className="pitch-stripes grid grid-cols-2 gap-px bg-edge md:grid-cols-3 lg:grid-cols-4">
            {GROUPS.map((g) => (
              <div key={g.letter} className="bg-ink p-5">
                <div className="mb-3 flex items-baseline justify-between">
                  <div className="display-md text-pitch">Group {g.letter}</div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted">
                    4 teams
                  </div>
                </div>
                <ul className="space-y-1.5">
                  {g.teams.map((t) => (
                    <li key={t.code} className="flex items-center gap-2 text-sm">
                      <span>{t.flag}</span>
                      <span className="text-cream">{t.name}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <footer className="border-t border-edge">
          <div className="container-page flex flex-col items-start justify-between gap-3 py-8 sm:flex-row sm:items-center">
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted">
              Bracket 26 · A fan-made site · Not affiliated with FIFA
            </div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted">
              Final · 19 July · MetLife Stadium · East Rutherford NJ
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}

function Stat({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <div>
      <div
        className={`font-display text-5xl leading-none ${
          accent ? "text-pitch" : "text-cream"
        }`}
      >
        {value}
      </div>
      <div className="eyebrow mt-1">{label}</div>
    </div>
  );
}

function Step({ num, title, desc }: { num: string; title: string; desc: string }) {
  return (
    <div className="border-l border-edge p-6 first:border-l-0 md:p-8">
      <div className="font-mono text-xs text-pitch">{num}</div>
      <h3 className="display-md mt-3 text-cream">{title}</h3>
      <p className="mt-3 text-muted">{desc}</p>
    </div>
  );
}
