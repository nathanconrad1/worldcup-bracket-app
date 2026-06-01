# Bracket 26 — 2026 World Cup Bracket App

A free, deployable web app where users sign up, build their 2026 FIFA World Cup bracket
(48 teams, 12 groups, 32-team knockout), and share their picks publicly.

**Stack:** Next.js 14 + Supabase (auth + Postgres) + Tailwind. Hosted free on Vercel.

---

## What you get out of the box

- **Sign up / sign in** with email + password (Supabase Auth)
- **Group stage builder** — rank all 4 teams in each of the 12 groups
- **Third-place selector** — pick which 8 of the 12 third-placed teams advance
- **Knockout bracket** — Round of 32 → Round of 16 → Quarters → Semis → Third-place + Final
- **Auto-saved** to Postgres as the user clicks
- **Public share link** — every bracket gets `/b/{id}`
- **Leaderboard** — index of all public brackets

All 48 teams are pre-loaded with the December 2025 draw and the March 2026 playoff results.

---

## Setup — five steps, ~10 minutes

### 1. Install dependencies

```bash
npm install
```

### 2. Create a free Supabase project

1. Go to **https://supabase.com** and sign up (it's free).
2. Click **New project**. Name it whatever you want (e.g. `worldcup-bracket`).
3. Pick a **strong database password** and save it somewhere safe.
4. Pick the region closest to your users.
5. Wait ~1 minute for it to provision.

### 3. Run the database schema

1. In your Supabase dashboard, click **SQL Editor** (left sidebar) → **New query**.
2. Open the file `supabase/schema.sql` from this repo, copy the whole thing, paste it
   into the SQL editor, and click **Run**.
3. You should see "Success. No rows returned." — that's correct.

This creates two tables (`profiles`, `brackets`), enables Row Level Security, and adds
a trigger that auto-creates a profile row whenever someone signs up.

### 4. Wire up local environment variables

1. In Supabase, go to **Project Settings → API**.
2. Copy the **Project URL** and the **anon public key** (NOT the service_role key).
3. In this repo, copy `.env.local.example` to `.env.local`:
   ```bash
   cp .env.local.example .env.local
   ```
4. Paste your values into `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJh...
   ```

### 5. Run it locally

```bash
npm run dev
```

Open **http://localhost:3000** — you're live. Create an account, make a bracket.

> **Note about email confirmation:** by default Supabase sends a confirmation email when
> users sign up. While testing, you can disable this at **Authentication → Sign In / Up
> → Email → Uncheck "Confirm email"**. Or leave it on and just confirm via the email link.

---

## Deploy free on Vercel — three steps, ~5 minutes

### 1. Push this repo to GitHub

```bash
git init
git add .
git commit -m "initial bracket app"
gh repo create worldcup-bracket --public --source=. --push
```

(Or use the GitHub website to create a repo and push.)

### 2. Import to Vercel

1. Go to **https://vercel.com** and sign up with your GitHub account.
2. Click **Add New… → Project** and select your `worldcup-bracket` repo.
3. In the **Environment Variables** section, add the same two variables from `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Click **Deploy**. Done in ~90 seconds.

You'll get a URL like `worldcup-bracket-xyz.vercel.app`. Share it with anyone — they
can sign up and make their own bracket.

### 3. Tell Supabase about your Vercel domain

This is needed so confirmation emails redirect to the right place.

1. In Supabase: **Authentication → URL Configuration**.
2. Set **Site URL** to your Vercel URL (e.g. `https://worldcup-bracket-xyz.vercel.app`).
3. Add the same URL to **Redirect URLs**, plus `http://localhost:3000` for local dev.

---

## How the bracket logic works

Picks live in a single JSON column on the `brackets` table:

```jsonc
{
  "groupStandings": {
    "A": ["MEX", "KOR", "RSA", "CZE"],   // 1st, 2nd, 3rd, 4th
    "B": [...]
  },
  "thirdPlaceAdvance": ["A", "C", "D", "F", "G", "I", "J", "L"],  // 8 of 12
  "matchWinners": {
    "R32-1": "MEX",
    "R32-2": "BRA",
    ...
    "F": "ARG"
  }
}
```

The matchups for the knockout rounds are defined in `src/lib/tournament.ts` (constant
`MATCHES`). Slots reference group standings (`{kind:"winner",group:"A"}`) or earlier
match winners (`{kind:"winnerOf",matchId:"R32-1"}`), and they get resolved to actual
team codes by `resolveSlot()` whenever the bracket renders.

The simplified Round-of-32 pairings used here avoid same-group rematches but don't
exactly mirror FIFA's complex third-place lookup table. That's a sensible trade-off
for a fan bracket — easy to reason about, no edge cases.

---

## Free-tier limits

- **Supabase free:** 500 MB database, 50,000 monthly active users, 5 GB bandwidth.
  A bracket is ~2 KB of JSON. You'd need 250,000+ users to fill the database.
- **Vercel Hobby:** 100 GB bandwidth/month, unlimited static site requests.
  Each bracket page is ~50 KB. Plenty of room for hundreds of thousands of views.

You will not hit a paid tier for a friend group, a class, or even a small subreddit.

---

## Possible next steps

- **Scoring once games start.** Add a `results` table mirroring the picks shape, then
  compute points per bracket (e.g. 1 pt per group winner, 2 pt per R16 winner, etc.).
- **Private leagues.** Add a `leagues` table and a `bracket_leagues` join table.
- **Real FIFA Round-of-32 pairings.** Replace the simplified pairings in
  `src/lib/tournament.ts` with FIFA's official lookup table once it's published.
- **OAuth sign-in.** Supabase supports Google, GitHub, etc. — flip the toggle in the
  Auth provider settings and add a button.

---

## File map

```
src/
  app/
    page.tsx              landing page + sign in
    bracket/page.tsx      authenticated bracket builder
    b/[id]/page.tsx       public read-only bracket view
    leaderboard/page.tsx  index of all public brackets
    auth/callback/route.ts confirmation email handler
  components/
    BracketBuilder.tsx    interactive picker (the main UI)
    AuthForm.tsx          sign in / sign up form
    Header.tsx            shared nav
  lib/
    tournament.ts         all 48 teams, 12 groups, knockout structure
    types.ts              BracketPicks shape + slot resolver
    supabase/             auth-aware Supabase clients
supabase/
  schema.sql              run this once in the SQL editor
```
