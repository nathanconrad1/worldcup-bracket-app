// 2026 FIFA World Cup tournament data.
// Source: official draw of December 5, 2025, plus playoff results through March 2026.

export type Team = {
  code: string;   // 3-letter FIFA code
  name: string;
  flag: string;   // emoji flag
};

export type Group = {
  letter: string;
  teams: Team[];
};

export const GROUPS: Group[] = [
  {
    letter: "A",
    teams: [
      { code: "MEX", name: "Mexico", flag: "🇲🇽" },
      { code: "RSA", name: "South Africa", flag: "🇿🇦" },
      { code: "KOR", name: "South Korea", flag: "🇰🇷" },
      { code: "CZE", name: "Czechia", flag: "🇨🇿" },
    ],
  },
  {
    letter: "B",
    teams: [
      { code: "CAN", name: "Canada", flag: "🇨🇦" },
      { code: "SUI", name: "Switzerland", flag: "🇨🇭" },
      { code: "QAT", name: "Qatar", flag: "🇶🇦" },
      { code: "BIH", name: "Bosnia & Herzegovina", flag: "🇧🇦" },
    ],
  },
  {
    letter: "C",
    teams: [
      { code: "BRA", name: "Brazil", flag: "🇧🇷" },
      { code: "MAR", name: "Morocco", flag: "🇲🇦" },
      { code: "HAI", name: "Haiti", flag: "🇭🇹" },
      { code: "SCO", name: "Scotland", flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿" },
    ],
  },
  {
    letter: "D",
    teams: [
      { code: "USA", name: "United States", flag: "🇺🇸" },
      { code: "PAR", name: "Paraguay", flag: "🇵🇾" },
      { code: "AUS", name: "Australia", flag: "🇦🇺" },
      { code: "TUR", name: "Türkiye", flag: "🇹🇷" },
    ],
  },
  {
    letter: "E",
    teams: [
      { code: "GER", name: "Germany", flag: "🇩🇪" },
      { code: "ECU", name: "Ecuador", flag: "🇪🇨" },
      { code: "CIV", name: "Côte d'Ivoire", flag: "🇨🇮" },
      { code: "CUW", name: "Curaçao", flag: "🇨🇼" },
    ],
  },
  {
    letter: "F",
    teams: [
      { code: "NED", name: "Netherlands", flag: "🇳🇱" },
      { code: "JPN", name: "Japan", flag: "🇯🇵" },
      { code: "SWE", name: "Sweden", flag: "🇸🇪" },
      { code: "TUN", name: "Tunisia", flag: "🇹🇳" },
    ],
  },
  {
    letter: "G",
    teams: [
      { code: "BEL", name: "Belgium", flag: "🇧🇪" },
      { code: "EGY", name: "Egypt", flag: "🇪🇬" },
      { code: "IRN", name: "Iran", flag: "🇮🇷" },
      { code: "NZL", name: "New Zealand", flag: "🇳🇿" },
    ],
  },
  {
    letter: "H",
    teams: [
      { code: "ESP", name: "Spain", flag: "🇪🇸" },
      { code: "URU", name: "Uruguay", flag: "🇺🇾" },
      { code: "KSA", name: "Saudi Arabia", flag: "🇸🇦" },
      { code: "CPV", name: "Cabo Verde", flag: "🇨🇻" },
    ],
  },
  {
    letter: "I",
    teams: [
      { code: "FRA", name: "France", flag: "🇫🇷" },
      { code: "SEN", name: "Senegal", flag: "🇸🇳" },
      { code: "NOR", name: "Norway", flag: "🇳🇴" },
      { code: "IRQ", name: "Iraq", flag: "🇮🇶" },
    ],
  },
  {
    letter: "J",
    teams: [
      { code: "ARG", name: "Argentina", flag: "🇦🇷" },
      { code: "ALG", name: "Algeria", flag: "🇩🇿" },
      { code: "AUT", name: "Austria", flag: "🇦🇹" },
      { code: "JOR", name: "Jordan", flag: "🇯🇴" },
    ],
  },
  {
    letter: "K",
    teams: [
      { code: "POR", name: "Portugal", flag: "🇵🇹" },
      { code: "COL", name: "Colombia", flag: "🇨🇴" },
      { code: "UZB", name: "Uzbekistan", flag: "🇺🇿" },
      { code: "COD", name: "DR Congo", flag: "🇨🇩" },
    ],
  },
  {
    letter: "L",
    teams: [
      { code: "ENG", name: "England", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
      { code: "CRO", name: "Croatia", flag: "🇭🇷" },
      { code: "GHA", name: "Ghana", flag: "🇬🇭" },
      { code: "PAN", name: "Panama", flag: "🇵🇦" },
    ],
  },
];

// Helper: get team by code
export function teamByCode(code: string): Team | undefined {
  for (const g of GROUPS) {
    for (const t of g.teams) if (t.code === code) return t;
  }
  return undefined;
}

// =============================================================================
// Knockout bracket structure
// =============================================================================
// 32 teams advance: 12 group winners + 12 runners-up + 8 best 3rd-placed teams.
// We use a simplified, sane pairing structure that avoids same-group rematches
// in the Round of 32 and gives a clean visual bracket. Slot positions reference
// group standings: "1A" = winner of A, "2A" = runner-up of A, "3rd-1" = first
// of the 8 user-selected third-place teams (in order picked).

export type KnockoutSlot =
  | { kind: "winner"; group: string }      // 1A, 1B, ...
  | { kind: "runnerup"; group: string }    // 2A, 2B, ...
  | { kind: "third"; index: number };      // 3rd-1 ... 3rd-8

export type Match = {
  id: string;       // R32-1, R16-1, QF-1, SF-1, F, TPM
  round: "R32" | "R16" | "QF" | "SF" | "F" | "TPM";
  slotA: KnockoutSlot | { kind: "winnerOf"; matchId: string } | { kind: "loserOf"; matchId: string };
  slotB: KnockoutSlot | { kind: "winnerOf"; matchId: string } | { kind: "loserOf"; matchId: string };
};

// Round of 32 — 16 matches arranged top-half vs bottom-half
// Top half: M1-M8 → R16-1..4 → QF-1, QF-2 → SF-1
// Bottom half: M9-M16 → R16-5..8 → QF-3, QF-4 → SF-2
// Final: SF-1 winner vs SF-2 winner
// Third-place: SF-1 loser vs SF-2 loser
export const MATCHES: Match[] = [
  // Round of 32 — top half
  { id: "R32-1",  round: "R32", slotA: { kind: "winner", group: "A" }, slotB: { kind: "third", index: 1 } },
  { id: "R32-2",  round: "R32", slotA: { kind: "runnerup", group: "C" }, slotB: { kind: "runnerup", group: "F" } },
  { id: "R32-3",  round: "R32", slotA: { kind: "winner", group: "B" }, slotB: { kind: "third", index: 2 } },
  { id: "R32-4",  round: "R32", slotA: { kind: "runnerup", group: "A" }, slotB: { kind: "runnerup", group: "D" } },
  { id: "R32-5",  round: "R32", slotA: { kind: "winner", group: "C" }, slotB: { kind: "third", index: 3 } },
  { id: "R32-6",  round: "R32", slotA: { kind: "runnerup", group: "E" }, slotB: { kind: "runnerup", group: "H" } },
  { id: "R32-7",  round: "R32", slotA: { kind: "winner", group: "D" }, slotB: { kind: "third", index: 4 } },
  { id: "R32-8",  round: "R32", slotA: { kind: "runnerup", group: "B" }, slotB: { kind: "runnerup", group: "G" } },
  // Round of 32 — bottom half
  { id: "R32-9",  round: "R32", slotA: { kind: "winner", group: "E" }, slotB: { kind: "third", index: 5 } },
  { id: "R32-10", round: "R32", slotA: { kind: "runnerup", group: "I" }, slotB: { kind: "runnerup", group: "L" } },
  { id: "R32-11", round: "R32", slotA: { kind: "winner", group: "F" }, slotB: { kind: "third", index: 6 } },
  { id: "R32-12", round: "R32", slotA: { kind: "runnerup", group: "J" }, slotB: { kind: "runnerup", group: "K" } },
  { id: "R32-13", round: "R32", slotA: { kind: "winner", group: "G" }, slotB: { kind: "third", index: 7 } },
  { id: "R32-14", round: "R32", slotA: { kind: "winner", group: "I" }, slotB: { kind: "third", index: 8 } },
  { id: "R32-15", round: "R32", slotA: { kind: "winner", group: "H" }, slotB: { kind: "winner", group: "K" } },
  { id: "R32-16", round: "R32", slotA: { kind: "winner", group: "J" }, slotB: { kind: "winner", group: "L" } },

  // Round of 16
  { id: "R16-1", round: "R16", slotA: { kind: "winnerOf", matchId: "R32-1" },  slotB: { kind: "winnerOf", matchId: "R32-2" } },
  { id: "R16-2", round: "R16", slotA: { kind: "winnerOf", matchId: "R32-3" },  slotB: { kind: "winnerOf", matchId: "R32-4" } },
  { id: "R16-3", round: "R16", slotA: { kind: "winnerOf", matchId: "R32-5" },  slotB: { kind: "winnerOf", matchId: "R32-6" } },
  { id: "R16-4", round: "R16", slotA: { kind: "winnerOf", matchId: "R32-7" },  slotB: { kind: "winnerOf", matchId: "R32-8" } },
  { id: "R16-5", round: "R16", slotA: { kind: "winnerOf", matchId: "R32-9" },  slotB: { kind: "winnerOf", matchId: "R32-10" } },
  { id: "R16-6", round: "R16", slotA: { kind: "winnerOf", matchId: "R32-11" }, slotB: { kind: "winnerOf", matchId: "R32-12" } },
  { id: "R16-7", round: "R16", slotA: { kind: "winnerOf", matchId: "R32-13" }, slotB: { kind: "winnerOf", matchId: "R32-14" } },
  { id: "R16-8", round: "R16", slotA: { kind: "winnerOf", matchId: "R32-15" }, slotB: { kind: "winnerOf", matchId: "R32-16" } },

  // Quarterfinals
  { id: "QF-1", round: "QF", slotA: { kind: "winnerOf", matchId: "R16-1" }, slotB: { kind: "winnerOf", matchId: "R16-2" } },
  { id: "QF-2", round: "QF", slotA: { kind: "winnerOf", matchId: "R16-3" }, slotB: { kind: "winnerOf", matchId: "R16-4" } },
  { id: "QF-3", round: "QF", slotA: { kind: "winnerOf", matchId: "R16-5" }, slotB: { kind: "winnerOf", matchId: "R16-6" } },
  { id: "QF-4", round: "QF", slotA: { kind: "winnerOf", matchId: "R16-7" }, slotB: { kind: "winnerOf", matchId: "R16-8" } },

  // Semifinals
  { id: "SF-1", round: "SF", slotA: { kind: "winnerOf", matchId: "QF-1" }, slotB: { kind: "winnerOf", matchId: "QF-2" } },
  { id: "SF-2", round: "SF", slotA: { kind: "winnerOf", matchId: "QF-3" }, slotB: { kind: "winnerOf", matchId: "QF-4" } },

  // Third-place playoff
  { id: "TPM", round: "TPM", slotA: { kind: "loserOf", matchId: "SF-1" }, slotB: { kind: "loserOf", matchId: "SF-2" } },

  // Final
  { id: "F", round: "F", slotA: { kind: "winnerOf", matchId: "SF-1" }, slotB: { kind: "winnerOf", matchId: "SF-2" } },
];
