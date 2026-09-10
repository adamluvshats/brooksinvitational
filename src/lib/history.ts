/**
 * Past Brooks Invitational champions, shown on the public landing page.
 *
 * These are the years that predate this app (results weren't tracked in it),
 * so they're recorded here as static history. EDIT THESE with your real
 * champions. Any tournament you run and mark COMPLETE inside the app is added
 * to the "Hall of Champions" automatically from its final standings.
 */
export interface PastWinner {
  year: number;
  champion: string;
  runnerUp?: string;
  note?: string;
}

export const PAST_WINNERS: PastWinner[] = [
  { year: 2025, champion: "TBD — edit in src/lib/history.ts" },
  { year: 2024, champion: "TBD — edit in src/lib/history.ts" },
  { year: 2023, champion: "TBD — edit in src/lib/history.ts" },
  { year: 2022, champion: "TBD — edit in src/lib/history.ts" },
  { year: 2021, champion: "TBD — edit in src/lib/history.ts" },
  { year: 2020, champion: "TBD — edit in src/lib/history.ts" },
];
