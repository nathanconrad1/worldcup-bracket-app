import { GROUPS, MATCHES, type Match, teamByCode } from "./tournament";

// The shape of bracket picks stored in the DB.
// - groupStandings: per group, an ordered list of team codes [1st, 2nd, 3rd, 4th]
// - thirdPlaceAdvance: array of group letters whose 3rd-place team advances (must be 8)
// - matchWinners: map from matchId -> winning team code
export type BracketPicks = {
  groupStandings: Record<string, string[]>;        // "A": ["MEX", "KOR", "RSA", "CZE"]
  thirdPlaceAdvance: string[];                      // ["A", "C", "D", "F", "G", "I", "J", "L"]
  matchWinners: Record<string, string>;             // "R32-1": "MEX"
};

export function emptyPicks(): BracketPicks {
  return {
    groupStandings: {},
    thirdPlaceAdvance: [],
    matchWinners: {},
  };
}

// Resolve a knockout slot to an actual team code (or null if unknown/incomplete).
export function resolveSlot(
  slot: Match["slotA"],
  picks: BracketPicks
): string | null {
  if ("group" in slot) {
    const standings = picks.groupStandings[slot.group];
    if (!standings) return null;
    if (slot.kind === "winner") return standings[0] ?? null;
    if (slot.kind === "runnerup") return standings[1] ?? null;
  }
  if (slot.kind === "third") {
    const idx = slot.index - 1;
    const groupLetter = picks.thirdPlaceAdvance[idx];
    if (!groupLetter) return null;
    return picks.groupStandings[groupLetter]?.[2] ?? null;
  }
  if (slot.kind === "winnerOf") {
    return picks.matchWinners[slot.matchId] ?? null;
  }
  if (slot.kind === "loserOf") {
    const w = picks.matchWinners[slot.matchId];
    if (!w) return null;
    const m = MATCHES.find((x) => x.id === slot.matchId);
    if (!m) return null;
    const teamA = resolveSlot(m.slotA, picks);
    const teamB = resolveSlot(m.slotB, picks);
    if (teamA === w) return teamB;
    if (teamB === w) return teamA;
    return null;
  }
  return null;
}

// Display label when team isn't yet resolved
export function slotLabel(slot: Match["slotA"]): string {
  if ("group" in slot) {
    return slot.kind === "winner" ? `Winner ${slot.group}` : `Runner-up ${slot.group}`;
  }
  if (slot.kind === "third") return `3rd #${slot.index}`;
  if (slot.kind === "winnerOf") return `Winner ${slot.matchId}`;
  if (slot.kind === "loserOf") return `Loser ${slot.matchId}`;
  return "TBD";
}

// Pretty round name
export const ROUND_LABEL: Record<Match["round"], string> = {
  R32: "Round of 32",
  R16: "Round of 16",
  QF: "Quarterfinals",
  SF: "Semifinals",
  TPM: "Third Place Match",
  F: "Final",
};

// Validate that picks are complete enough to declare a champion
export function getChampion(picks: BracketPicks): string | null {
  return picks.matchWinners["F"] ?? null;
}

// How many of the 6 knockout rounds are filled in?
export function countCompletedMatches(picks: BracketPicks): number {
  return Object.keys(picks.matchWinners).length;
}

// Total expected: 16 (R32) + 8 + 4 + 2 + 1 (TPM) + 1 (F) = 32
export const TOTAL_KNOCKOUT_MATCHES = MATCHES.length;
export const TOTAL_GROUPS = GROUPS.length;
