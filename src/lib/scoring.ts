// Scoring: compares a user's bracket picks against the actual tournament results.
//
// Points (see POINTS below):
//   • Group stage   — 1 point for each team placed in its correct final group position
//   • Round of 32   — 2 points
//   • Round of 16   — 3
//   • Quarterfinals — 4
//   • Semifinals    — 5
//   • Third place    — 5  (same tier as the semifinals)
//   • Final         — 6
//
// Knockout scoring rewards HOW FAR a team goes, not exact bracket position: for
// each match in the user's bracket, the team they advanced earns that round's
// points if that team actually won a real match in the same round — regardless of
// which fixture they ended up in. This makes scoring immune to bracket misalignment
// (a mis-seeded group can't cascade into wrong downstream fixtures).
//
// Scoring is partial: only groups/matches that have an actual result entered count,
// so totals grow as the tournament progresses.

import { GROUPS, MATCHES, type Match } from "./tournament";
import { resolveSlot, type BracketPicks } from "./types";

export const POINTS = {
  // 1 point per team in its correct final position within its group (1st–4th).
  groupPosition: 1,
  // Knockout points per correctly predicted match winner, by round.
  round: {
    R32: 2,
    R16: 3,
    QF: 4,
    SF: 5,
    TPM: 5,
    F: 6,
  } as Record<Match["round"], number>,
};

export type ScoreBreakdown = {
  total: number;
  groupPoints: number;
  knockoutPoints: number;
  correctPositions: number;
  correctMatches: number;
};

const EMPTY: ScoreBreakdown = {
  total: 0,
  groupPoints: 0,
  knockoutPoints: 0,
  correctPositions: 0,
  correctMatches: 0,
};

// `actual` holds the real outcomes in the same shape as a user's picks.
export function scoreBracket(
  picks: BracketPicks,
  actual: BracketPicks | null
): ScoreBreakdown {
  if (!actual) return { ...EMPTY };

  let groupPoints = 0;
  let correctPositions = 0;
  for (const g of GROUPS) {
    const actualOrder = actual.groupStandings?.[g.letter];
    const predOrder = picks.groupStandings?.[g.letter];
    if (!actualOrder || !predOrder) continue;
    for (let i = 0; i < actualOrder.length; i++) {
      if (actualOrder[i] && actualOrder[i] === predOrder[i]) {
        groupPoints += POINTS.groupPosition;
        correctPositions++;
      }
    }
  }

  const advancers = actualAdvancersByRound(actual);
  let knockoutPoints = 0;
  let correctMatches = 0;
  for (const m of MATCHES) {
    const pick = picks.matchWinners?.[m.id];
    // You earn the round's points if the team you advanced from this match
    // actually won a real match in that round (i.e., really advanced past it).
    if (pick && advancers[m.round].has(pick)) {
      knockoutPoints += POINTS.round[m.round] ?? 0;
      correctMatches++;
    }
  }

  return {
    total: groupPoints + knockoutPoints,
    groupPoints,
    knockoutPoints,
    correctPositions,
    correctMatches,
  };
}

// True if any actual result has been entered yet (groups or matches).
export function hasAnyResults(actual: BracketPicks | null): boolean {
  if (!actual) return false;
  const groups = Object.keys(actual.groupStandings ?? {}).length > 0;
  const matches = Object.keys(actual.matchWinners ?? {}).length > 0;
  return groups || matches;
}

// Teams that actually won a match in each round (i.e., advanced past that round).
// Used both for scoring and for the bracket overlay (✓ / points badges).
export function actualAdvancersByRound(
  actual: BracketPicks | null
): Record<Match["round"], Set<string>> {
  const map: Record<Match["round"], Set<string>> = {
    R32: new Set(), R16: new Set(), QF: new Set(), SF: new Set(), F: new Set(), TPM: new Set(),
  };
  if (!actual) return map;
  for (const m of MATCHES) {
    const w = actual.matchWinners?.[m.id];
    if (w) map[m.round].add(w);
  }
  return map;
}

// How one knockout slot should render once results are live. Centralizes the
// "checkmark on correct guesses" rule so the builder and public page match.
//
// Per slot we know: your team here (pick), the team that ACTUALLY ended up here
// (actualOccupant), and whether you picked your team to win this match. A correct
// guess = you advanced a team this round AND that team really advanced this round.
// The ✓ attaches to whichever team is the real advancer in this slot:
//   • right spot  → your team (main),
//   • wrong spot  → the small "actual → X" team (the team you called, shown where
//                    it really is).
export type SlotView = {
  struck: boolean; // strike your team's name (eliminated here / lost this round)
  dim: boolean; // your team is alive but in the wrong spot
  green: boolean; // your correct winner pick (right spot)
  mainCheck: boolean; // ✓ next to your team
  smallCheck: boolean; // ✓ next to the small actual team
  actualCode: string | null; // small "actual → X" team, or null when you were right
};

export function knockoutSlotView(opts: {
  round: Match["round"];
  pick: string | null;
  actualOccupant: string | null;
  isWinnerPick: boolean;
  eliminated: Set<string>;
  advancers: Record<Match["round"], Set<string>>;
  userAdvancers: Record<Match["round"], Set<string>>;
}): SlotView {
  const { round, pick: P, actualOccupant: Q, isWinnerPick, eliminated, advancers, userAdvancers } = opts;
  const adv = advancers[round];
  const uadv = userAdvancers[round];
  const pAdvanced = !!P && adv.has(P);
  const wrongOccupant = !!Q && Q !== P;

  if (wrongOccupant) {
    const pOut = !!P && eliminated.has(P);
    return {
      struck: pOut,
      dim: !pOut,
      green: false,
      mainCheck: false,
      // You correctly called this team to go through this round, just elsewhere.
      smallCheck: adv.has(Q!) && uadv.has(Q!),
      actualCode: Q,
    };
  }

  if (Q) {
    // You had the right team in this slot. Strike them only if they actually went
    // out (didn't advance this round AND are eliminated) — not when the round is
    // simply unplayed yet.
    return {
      struck: !pAdvanced && eliminated.has(Q),
      dim: false,
      green: pAdvanced && isWinnerPick,
      mainCheck: pAdvanced && isWinnerPick,
      smallCheck: false,
      actualCode: null,
    };
  }

  // Reality for this slot isn't decided yet.
  const pOut = !!P && eliminated.has(P);
  return {
    struck: pOut,
    dim: false,
    green: isWinnerPick && !pOut,
    mainCheck: false,
    smallCheck: false,
    actualCode: null,
  };
}

// The set of team codes that are OUT of the real tournament, derived from the
// actual results: group 4th-placers, non-advancing 3rd-placers (once the 8 are
// known), and the loser of every played knockout match.
export function eliminatedTeams(actual: BracketPicks | null): Set<string> {
  const out = new Set<string>();
  if (!actual) return out;

  for (const g of GROUPS) {
    const order = actual.groupStandings?.[g.letter];
    if (!order || order.length < 4) continue; // group not final yet
    if (order[3]) out.add(order[3]); // 4th place always eliminated
    const thirdsDecided = (actual.thirdPlaceAdvance?.length ?? 0) === 8;
    if (thirdsDecided && order[2] && !actual.thirdPlaceAdvance.includes(g.letter)) {
      out.add(order[2]); // 3rd that didn't make the best-8
    }
  }

  for (const m of MATCHES) {
    const w = actual.matchWinners?.[m.id];
    if (!w) continue;
    const a = resolveSlot(m.slotA, actual);
    const b = resolveSlot(m.slotB, actual);
    const loser = w === a ? b : w === b ? a : null;
    if (loser) out.add(loser);
  }
  return out;
}
