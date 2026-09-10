import { describe, it, expect } from "vitest";
import {
  strokesForHole,
  teamHandicap,
  scoreScrambleRound,
  scrambleRoundPlayerPoints,
  computeStandings,
  sumPoints,
  buildPlayoffBracket,
  resolvePlayoff,
  classToHandicap,
  type HoleInfo,
  type ScrambleTeamInput,
} from "./scoring";

// A full 18-hole course: stroke index == hole number for easy reasoning
// (hole 1 hardest, hole 18 easiest).
const course18: HoleInfo[] = Array.from({ length: 18 }, (_, i) => ({
  number: i + 1,
  par: 4,
  strokeIndex: i + 1,
}));

describe("strokesForHole", () => {
  it("gives 0 strokes to a scratch handicap", () => {
    expect(course18.map((h) => strokesForHole(0, h.strokeIndex))).toEqual(
      Array(18).fill(0),
    );
  });

  it("a 10 handicap gets a stroke on the 10 hardest holes", () => {
    const got = course18.map((h) => strokesForHole(10, h.strokeIndex));
    // index 1-10 => 1 stroke, 11-18 => 0
    expect(got).toEqual([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it("a 15 handicap gets strokes on the 15 hardest holes", () => {
    const total = course18.reduce((s, h) => s + strokesForHole(15, h.strokeIndex), 0);
    expect(total).toBe(15);
    expect(strokesForHole(15, 16)).toBe(0);
    expect(strokesForHole(15, 15)).toBe(1);
  });

  it("a 20 handicap wraps: 2 strokes on the 2 hardest, 1 on the rest", () => {
    expect(strokesForHole(20, 1)).toBe(2);
    expect(strokesForHole(20, 2)).toBe(2);
    expect(strokesForHole(20, 3)).toBe(1);
    expect(strokesForHole(20, 18)).toBe(1);
  });
});

describe("teamHandicap", () => {
  it("MAX: a 5 and 10 partner play off 10 (spec example)", () => {
    expect(teamHandicap(classToHandicap("A"), classToHandicap("B"), "MAX")).toBe(10);
  });
  it("MAX: a 10 and 15 partner play off 15 (spec example)", () => {
    expect(teamHandicap(classToHandicap("B"), classToHandicap("C"), "MAX")).toBe(15);
  });
  it("DIFFERENCE and AVERAGE modes", () => {
    expect(teamHandicap(5, 10, "DIFFERENCE")).toBe(5);
    expect(teamHandicap(5, 10, "AVERAGE")).toBe(8);
  });
});

describe("scoreScrambleRound", () => {
  const front9 = course18.slice(0, 9);

  it("awards 1 point per player to the outright hole winner", () => {
    const teams: ScrambleTeamInput[] = [
      { teamId: "t1", playerIds: ["p1", "p2"], handicap: 0, grossByHole: { 1: 2 } },
      { teamId: "t2", playerIds: ["p3", "p4"], handicap: 0, grossByHole: { 1: 4 } },
      { teamId: "t3", playerIds: ["p5", "p6"], handicap: 0, grossByHole: { 1: 5 } },
    ];
    const res = scoreScrambleRound(teams, [front9[0]]);
    expect(res.holePointsByPlayer).toEqual({ p1: 1, p2: 1 });
    expect(res.holeResults[0].winningTeamIds).toEqual(["t1"]);
  });

  it("splits points to all tied teams (3-way tie => 6 players score)", () => {
    const teams: ScrambleTeamInput[] = [
      { teamId: "t1", playerIds: ["p1", "p2"], handicap: 0, grossByHole: { 1: 3 } },
      { teamId: "t2", playerIds: ["p3", "p4"], handicap: 0, grossByHole: { 1: 3 } },
      { teamId: "t3", playerIds: ["p5", "p6"], handicap: 0, grossByHole: { 1: 3 } },
    ];
    const res = scoreScrambleRound(teams, [front9[0]]);
    expect(res.holePointsByPlayer).toEqual({ p1: 1, p2: 1, p3: 1, p4: 1, p5: 1, p6: 1 });
  });

  it("uses NET score: a high handicap can win with a worse gross", () => {
    // Hole 1 has stroke index 1 (hardest) -> a 10 handicap gets a stroke there.
    const teams: ScrambleTeamInput[] = [
      { teamId: "scratch", playerIds: ["a", "b"], handicap: 0, grossByHole: { 1: 4 } },
      { teamId: "tencap", playerIds: ["c", "d"], handicap: 10, grossByHole: { 1: 4 } },
    ];
    const res = scoreScrambleRound(teams, [front9[0]]);
    // scratch net 4, tencap net 3 -> tencap wins
    expect(res.holeResults[0].winningTeamIds).toEqual(["tencap"]);
    expect(res.holePointsByPlayer).toEqual({ c: 1, d: 1 });
  });

  it("flags holes incomplete until every team enters", () => {
    const teams: ScrambleTeamInput[] = [
      { teamId: "t1", playerIds: ["p1", "p2"], handicap: 0, grossByHole: { 1: 3 } },
      { teamId: "t2", playerIds: ["p3", "p4"], handicap: 0, grossByHole: {} },
    ];
    const res = scoreScrambleRound(teams, [front9[0]]);
    expect(res.holeResults[0].complete).toBe(false);
  });

  it("max single-round total is 11 (9 holes + LD + CTP)", () => {
    // One dominant team wins all 9 holes; one of its players also holds LD and CTP.
    const grossByHole: Record<number, number> = {};
    for (let h = 1; h <= 9; h++) grossByHole[h] = 2;
    const teams: ScrambleTeamInput[] = [
      { teamId: "win", playerIds: ["star", "partner"], handicap: 0, grossByHole },
      {
        teamId: "lose",
        playerIds: ["x", "y"],
        handicap: 0,
        grossByHole: Object.fromEntries(Array.from({ length: 9 }, (_, i) => [i + 1, 6])),
      },
    ];
    const res = scoreScrambleRound(teams, front9);
    const withAch = scrambleRoundPlayerPoints(res, [
      { type: "LONGEST_DRIVE", playerId: "star" },
      { type: "CLOSEST_TO_PIN", playerId: "star" },
    ]);
    expect(withAch.star).toBe(11);
    expect(withAch.partner).toBe(9);
  });
});

describe("standings & playoff", () => {
  it("seeds players and pairs 1v2, 3v4, 5v6, 7v8", () => {
    const points = { p1: 30, p2: 28, p3: 25, p4: 24, p5: 20, p6: 18, p7: 15, p8: 10 };
    const standings = computeStandings(points, Object.keys(points));
    expect(standings.map((s) => s.playerId)).toEqual([
      "p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8",
    ]);
    const bracket = buildPlayoffBracket(standings);
    expect(bracket.map((b) => [b.highSeedPlayerId, b.lowSeedPlayerId])).toEqual([
      ["p1", "p2"],
      ["p3", "p4"],
      ["p5", "p6"],
      ["p7", "p8"],
    ]);
    expect(bracket.map((b) => b.positions)).toEqual([[1, 2], [3, 4], [5, 6], [7, 8]]);
  });

  it("a seed can climb at most one slot — #4 can reach 3rd but not 1st", () => {
    const points = { p1: 30, p2: 28, p3: 25, p4: 24, p5: 20, p6: 18, p7: 15, p8: 10 };
    const standings = computeStandings(points, Object.keys(points));
    const bracket = buildPlayoffBracket(standings);

    // p4 shoots the lights out (net 30), p3 plays poorly (net 45); everyone else neutral.
    const holes = course18.slice(0, 9);
    const evenPar: Record<number, number> = Object.fromEntries(
      holes.map((h) => [h.number, 4]),
    );
    const players = Object.fromEntries(
      Object.keys(points).map((id) => [
        id,
        { playerId: id, handicap: 0, grossByHole: { ...evenPar } },
      ]),
    );
    // p4 great, p3 bad.
    players.p4.grossByHole = Object.fromEntries(holes.map((h) => [h.number, 2]));
    players.p3.grossByHole = Object.fromEntries(holes.map((h) => [h.number, 6]));

    const { finalPositions } = resolvePlayoff(bracket, players, holes);
    const pos = Object.fromEntries(finalPositions.map((f) => [f.playerId, f.finalPosition]));
    expect(pos.p4).toBe(3); // climbed from seed 4 to 3rd
    expect(pos.p3).toBe(4); // dropped from seed 3 to 4th
    expect(pos.p1).toBe(1); // top pair unaffected — p4 cannot reach 1st/2nd
    expect(pos.p2).toBe(2);
  });

  it("higher seed keeps the better position on a net tie", () => {
    const points = { p1: 10, p2: 8 };
    const standings = computeStandings(points, Object.keys(points));
    const bracket = buildPlayoffBracket(standings);
    const holes = course18.slice(0, 9);
    const tie: Record<number, number> = Object.fromEntries(holes.map((h) => [h.number, 4]));
    const players = {
      p1: { playerId: "p1", handicap: 0, grossByHole: { ...tie } },
      p2: { playerId: "p2", handicap: 0, grossByHole: { ...tie } },
    };
    const { finalPositions } = resolvePlayoff(bracket, players, holes);
    const pos = Object.fromEntries(finalPositions.map((f) => [f.playerId, f.finalPosition]));
    expect(pos.p1).toBe(1);
    expect(pos.p2).toBe(2);
  });
});

describe("sumPoints", () => {
  it("aggregates per-round maps", () => {
    expect(sumPoints([{ a: 3, b: 1 }, { a: 2, c: 5 }])).toEqual({ a: 5, b: 1, c: 5 });
  });
});
