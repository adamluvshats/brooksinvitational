/**
 * Seed a demo Brooks Invitational so the app is explorable immediately.
 * Run with: npm run db:seed
 *
 * Creates an admin login (admin / brooks123), 8 players, an 18-hole course,
 * the 7 scramble rounds with Longest Drive / Closest To Pin holes designated,
 * round 1 pairings, and a few sample scores.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// 18 holes — two par 5s and two par 3s per nine; unique stroke indexes 1-18.
const HOLES = [
  { number: 1, par: 4, strokeIndex: 5 },
  { number: 2, par: 4, strokeIndex: 9 },
  { number: 3, par: 5, strokeIndex: 1 },
  { number: 4, par: 4, strokeIndex: 13 },
  { number: 5, par: 3, strokeIndex: 17 },
  { number: 6, par: 4, strokeIndex: 3 },
  { number: 7, par: 4, strokeIndex: 7 },
  { number: 8, par: 3, strokeIndex: 15 },
  { number: 9, par: 5, strokeIndex: 11 },
  { number: 10, par: 4, strokeIndex: 6 },
  { number: 11, par: 5, strokeIndex: 2 },
  { number: 12, par: 3, strokeIndex: 18 },
  { number: 13, par: 4, strokeIndex: 10 },
  { number: 14, par: 4, strokeIndex: 4 },
  { number: 15, par: 4, strokeIndex: 8 },
  { number: 16, par: 3, strokeIndex: 16 },
  { number: 17, par: 5, strokeIndex: 12 },
  { number: 18, par: 4, strokeIndex: 14 },
];

const PLAYERS = [
  { displayName: "Brooks", handicapClass: "SCRATCH" as const, handicap: 0 },
  { displayName: "Dustin", handicapClass: "A" as const, handicap: 5 },
  { displayName: "Rory", handicapClass: "A" as const, handicap: 5 },
  { displayName: "Jordan", handicapClass: "B" as const, handicap: 10 },
  { displayName: "Justin", handicapClass: "B" as const, handicap: 10 },
  { displayName: "Bryson", handicapClass: "C" as const, handicap: 15 },
  { displayName: "Phil", handicapClass: "C" as const, handicap: 15 },
  { displayName: "Bubba", handicapClass: "D" as const, handicap: 20 },
];

async function main() {
  const passwordHash = await bcrypt.hash("brooks123", 10);
  const admin = await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      email: "admin@brooks.golf",
      passwordHash,
      displayName: "Tournament Admin",
      role: "ADMIN",
    },
  });

  const existing = await prisma.tournament.findFirst({ where: { name: "Brooks Invitational", year: 2026 } });
  if (existing) {
    console.log("Demo tournament already exists — skipping. (admin / brooks123)");
    return;
  }

  const tournament = await prisma.tournament.create({
    data: {
      name: "Brooks Invitational",
      year: 2026,
      status: "ACTIVE",
      handicapMode: "MAX",
      createdById: admin.id,
    },
  });

  const players = [];
  for (const p of PLAYERS) {
    players.push(
      await prisma.tournamentPlayer.create({
        data: {
          tournamentId: tournament.id,
          displayName: p.displayName,
          handicapClass: p.handicapClass,
          handicap: p.handicap,
          role: p.displayName === "Brooks" ? "TOURNAMENT_ADMIN" : "PLAYER",
        },
      }),
    );
  }
  // Link the admin user to the "Brooks" player so they can log in and score.
  await prisma.tournamentPlayer.update({ where: { id: players[0].id }, data: { userId: admin.id } });

  const course = await prisma.course.create({
    data: { tournamentId: tournament.id, name: "Brooks National", holes: { create: HOLES } },
  });

  const front = HOLES.slice(0, 9).map((h) => h.number);
  const back = HOLES.slice(9).map((h) => h.number);

  // 7 scramble rounds alternating nines.
  for (let i = 1; i <= 7; i++) {
    const holeNumbers = i % 2 === 1 ? front : back;
    const ldHole = HOLES.find((h) => holeNumbers.includes(h.number) && h.par === 5)!;
    const ctpHole = HOLES.find((h) => holeNumbers.includes(h.number) && h.par === 3)!;
    const round = await prisma.round.create({
      data: {
        tournamentId: tournament.id,
        courseId: course.id,
        roundNumber: i,
        name: `Round ${i}`,
        type: "SCRAMBLE",
        status: i === 1 ? "ACTIVE" : "PENDING",
        holeNumbers,
        achievements: {
          create: [
            { type: "LONGEST_DRIVE", holeNumber: ldHole.number },
            { type: "CLOSEST_TO_PIN", holeNumber: ctpHole.number },
          ],
        },
      },
    });

    if (i === 1) {
      // Round 1 pairings: (Brooks/Bubba), (Dustin/Phil), (Rory/Bryson), (Jordan/Justin).
      const pairs = [
        [players[0], players[7]],
        [players[1], players[6]],
        [players[2], players[5]],
        [players[3], players[4]],
      ];
      for (const [a, b] of pairs) {
        await prisma.team.create({
          data: {
            roundId: round.id,
            members: { create: [{ playerId: a.id }, { playerId: b.id }] },
          },
        });
      }
    }
  }

  console.log("Seeded demo 'Brooks Invitational'. Log in as admin / brooks123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
