"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AuthForm() {
  const router = useRouter();
  const supabase = createClient();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    try {
      if (mode === "signup") {
        if (username.length < 3) {
          throw new Error("Username must be at least 3 characters");
        }
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { username },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) throw error;
        // If email confirmation is on, no session is returned yet
        if (!data.session) {
          setInfo("Check your email for a confirmation link to finish signing up.");
        } else {
          router.push("/bracket");
          router.refresh();
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push("/bracket");
        router.refresh();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex gap-2 border-b border-edge pb-3">
        <button
          type="button"
          onClick={() => setMode("signin")}
          className={`flex-1 py-2 font-mono text-xs uppercase tracking-widest transition ${
            mode === "signin" ? "bg-cream text-ink" : "text-muted hover:text-cream"
          }`}
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => setMode("signup")}
          className={`flex-1 py-2 font-mono text-xs uppercase tracking-widest transition ${
            mode === "signup" ? "bg-cream text-ink" : "text-muted hover:text-cream"
          }`}
        >
          Create Account
        </button>
      </div>

      {mode === "signup" && (
        <div>
          <label className="eyebrow mb-1 block">Username</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            minLength={3}
            maxLength={24}
            pattern="[A-Za-z0-9_]+"
            placeholder="elcampeon_2026"
            className="w-full border border-edge bg-surface px-3 py-2.5 text-cream placeholder:text-muted focus:border-pitch focus:outline-none"
          />
        </div>
      )}

      <div>
        <label className="eyebrow mb-1 block">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full border border-edge bg-surface px-3 py-2.5 text-cream focus:border-pitch focus:outline-none"
        />
      </div>

      <div>
        <label className="eyebrow mb-1 block">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          className="w-full border border-edge bg-surface px-3 py-2.5 text-cream focus:border-pitch focus:outline-none"
        />
      </div>

      {error && (
        <div className="border border-sunset bg-sunset/10 p-3 font-mono text-xs text-sunset">
          {error}
        </div>
      )}
      {info && (
        <div className="border border-pitch bg-pitch/10 p-3 font-mono text-xs text-pitch">
          {info}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-pitch py-3 font-display text-xl uppercase tracking-wider text-ink hover:bg-cream disabled:opacity-50"
      >
        {loading ? "..." : mode === "signin" ? "Sign In" : "Create Account"}
      </button>
    </form>
  );
}
