// Scoring: compares a user's bracket picks against the actual tournament results.
//
// Points (see POINTS below):
//   • Group stage   — 1 point for each team placed in its correct final group position
//   • Round of 32   — 2 points per correctly predicted match winner
//   • Round of 16   — 3   "
//   • Quarterfinals — 4   "
//   • Semifinals    — 5   "
//   • Third place    — 5   "  (same tier as the semifinals)
//   • Final         — 6   "
//
// Scoring is partial: only groups/matches that have an actual result entered count,
// so totals grow as the tournament progresses.

import { GROUPS, MATCHES, type Match } from "./tournament";
import type { BracketPicks } from "./types";

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

  let knockoutPoints = 0;
  let correctMatches = 0;
  for (const m of MATCHES) {
    const actualWinner = actual.matchWinners?.[m.id];
    const predWinner = picks.matchWinners?.[m.id];
    if (actualWinner && actualWinner === predWinner) {
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
