"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function Header({
  username,
  signedIn,
}: {
  username?: string | null;
  signedIn: boolean;
}) {
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.refresh();
    router.push("/");
  }

  return (
    <header className="relative z-10 border-b border-edge bg-ink/80 backdrop-blur">
      <div className="container-page flex items-center justify-between py-4">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center bg-pitch text-ink">
            <span className="font-display text-lg leading-none">26</span>
          </div>
          <div>
            <div className="display-md text-cream">Bracket 26</div>
            <div className="eyebrow -mt-0.5">FIFA World Cup · USA · CAN · MEX</div>
          </div>
        </Link>

        <nav className="flex items-center gap-2 text-sm">
          <Link
            href="/leaderboard"
            className="px-3 py-2 font-mono text-xs uppercase tracking-widest text-muted hover:text-cream"
          >
            Leaderboard
          </Link>
          {signedIn ? (
            <>
              <Link
                href="/bracket"
                className="px-3 py-2 font-mono text-xs uppercase tracking-widest text-cream"
              >
                My Bracket
              </Link>
              <span className="hidden font-mono text-xs uppercase tracking-widest text-muted sm:inline">
                · {username}
              </span>
              <button
                onClick={signOut}
                className="ml-2 border border-edge bg-surface px-3 py-2 font-mono text-xs uppercase tracking-widest text-cream hover:border-sunset hover:text-sunset"
              >
                Sign out
              </button>
            </>
          ) : (
            <Link
              href="/"
              className="ml-2 bg-cream px-4 py-2 font-mono text-xs uppercase tracking-widest text-ink hover:bg-pitch"
            >
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
