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
// Knockout bracket structure — official 2026 layout (FIFA fixtures 73–104)
// =============================================================================
// 32 teams advance: 12 group winners + 12 runners-up + 8 best third-placed teams.
// Pairings follow the official bracket: a group winner is always drawn against a
// runner-up or a third-placed team — never another winner — and two teams from
// the same group cannot meet before the quarterfinals.
//
// The eight third-placed slots are conditional: which group's third-placed team
// lands in each slot depends on which eight groups qualify a third-placed team.
// That is governed by FIFA's official 495-combination allocation table, encoded
// in thirdPlaceAllocation.ts and resolved in lib/types.ts → resolveSlot().

export type KnockoutSlot =
  | { kind: "winner"; group: string }      // 1A, 1B, ...
  | { kind: "runnerup"; group: string }    // 2A, 2B, ...
  | { kind: "third"; match: number };      // best-third slot belonging to R32 match `match`

export type MatchRef =
  | { kind: "winnerOf"; matchId: string }
  | { kind: "loserOf"; matchId: string };

export type Slot = KnockoutSlot | MatchRef;

export type Match = {
  id: string;       // "M73" … "M104" — the official FIFA fixture number
  round: "R32" | "R16" | "QF" | "SF" | "F" | "TPM";
  slotA: Slot;
  slotB: Slot;
};

// Slot builders for readability
const W = (group: string): KnockoutSlot => ({ kind: "winner", group });
const R = (group: string): KnockoutSlot => ({ kind: "runnerup", group });
const T = (match: number): KnockoutSlot => ({ kind: "third", match });
const win = (n: number): MatchRef => ({ kind: "winnerOf", matchId: `M${n}` });
const lose = (n: number): MatchRef => ({ kind: "loserOf", matchId: `M${n}` });

export const MATCHES: Match[] = [
  // Round of 32 (fixtures 73–88)
  { id: "M73", round: "R32", slotA: R("A"), slotB: R("B") },
  { id: "M74", round: "R32", slotA: W("E"), slotB: T(74) },
  { id: "M75", round: "R32", slotA: W("F"), slotB: R("C") },
  { id: "M76", round: "R32", slotA: W("C"), slotB: R("F") },
  { id: "M77", round: "R32", slotA: W("I"), slotB: T(77) },
  { id: "M78", round: "R32", slotA: R("E"), slotB: R("I") },
  { id: "M79", round: "R32", slotA: W("A"), slotB: T(79) },
  { id: "M80", round: "R32", slotA: W("L"), slotB: T(80) },
  { id: "M81", round: "R32", slotA: W("D"), slotB: T(81) },
  { id: "M82", round: "R32", slotA: W("G"), slotB: T(82) },
  { id: "M83", round: "R32", slotA: R("K"), slotB: R("L") },
  { id: "M84", round: "R32", slotA: W("H"), slotB: R("J") },
  { id: "M85", round: "R32", slotA: W("B"), slotB: T(85) },
  { id: "M86", round: "R32", slotA: W("J"), slotB: R("H") },
  { id: "M87", round: "R32", slotA: W("K"), slotB: T(87) },
  { id: "M88", round: "R32", slotA: R("D"), slotB: R("G") },

  // Round of 16 (89–96)
  { id: "M89", round: "R16", slotA: win(74), slotB: win(77) },
  { id: "M90", round: "R16", slotA: win(73), slotB: win(75) },
  { id: "M91", round: "R16", slotA: win(76), slotB: win(78) },
  { id: "M92", round: "R16", slotA: win(79), slotB: win(80) },
  { id: "M93", round: "R16", slotA: win(83), slotB: win(84) },
  { id: "M94", round: "R16", slotA: win(81), slotB: win(82) },
  { id: "M95", round: "R16", slotA: win(86), slotB: win(88) },
  { id: "M96", round: "R16", slotA: win(85), slotB: win(87) },

  // Quarterfinals (97–100)
  { id: "M97",  round: "QF", slotA: win(89), slotB: win(90) },
  { id: "M98",  round: "QF", slotA: win(93), slotB: win(94) },
  { id: "M99",  round: "QF", slotA: win(91), slotB: win(92) },
  { id: "M100", round: "QF", slotA: win(95), slotB: win(96) },

  // Semifinals (101–102)
  { id: "M101", round: "SF", slotA: win(97), slotB: win(98) },
  { id: "M102", round: "SF", slotA: win(99), slotB: win(100) },

  // Third-place play-off (103)
  { id: "M103", round: "TPM", slotA: lose(101), slotB: lose(102) },

  // Final (104)
  { id: "M104", round: "F", slotA: win(101), slotB: win(102) },
];

// Well-known match ids
export const FINAL_MATCH_ID = "M104";
export const THIRD_PLACE_MATCH_ID = "M103";
