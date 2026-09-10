import { z } from "zod";

export const registerSchema = z.object({
  username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_.-]+$/, "letters, numbers, . _ - only"),
  email: z.string().email(),
  password: z.string().min(6).max(200),
  displayName: z.string().min(1).max(60),
});

export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const createTournamentSchema = z.object({
  name: z.string().min(1).max(120),
  year: z.number().int().min(2000).max(2100),
  handicapMode: z.enum(["MAX", "DIFFERENCE", "AVERAGE"]).default("MAX"),
});

export const updateTournamentSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  year: z.number().int().min(2000).max(2100).optional(),
  status: z.enum(["SETUP", "ACTIVE", "PLAYOFF", "COMPLETE"]).optional(),
  handicapMode: z.enum(["MAX", "DIFFERENCE", "AVERAGE"]).optional(),
  pointsPerHole: z.number().int().min(1).max(10).optional(),
});

export const handicapClassSchema = z.enum(["SCRATCH", "A", "B", "C", "D"]);

export const addPlayerSchema = z.object({
  displayName: z.string().min(1).max(60),
  userId: z.string().optional(),
  handicapClass: handicapClassSchema.default("A"),
  handicap: z.number().int().min(0).max(54).optional(),
  role: z.enum(["TOURNAMENT_ADMIN", "PLAYER"]).default("PLAYER"),
});

export const updatePlayerSchema = z.object({
  displayName: z.string().min(1).max(60).optional(),
  handicapClass: handicapClassSchema.optional(),
  handicap: z.number().int().min(0).max(54).optional(),
  role: z.enum(["TOURNAMENT_ADMIN", "PLAYER"]).optional(),
  userId: z.string().nullable().optional(),
});

export const holeSchema = z.object({
  number: z.number().int().min(1).max(18),
  par: z.number().int().min(3).max(6),
  strokeIndex: z.number().int().min(1).max(18),
});

export const createCourseSchema = z.object({
  name: z.string().min(1).max(120),
  holes: z.array(holeSchema).length(18),
});

export const createRoundSchema = z.object({
  roundNumber: z.number().int().min(1).max(8),
  name: z.string().min(1).max(120),
  type: z.enum(["SCRAMBLE", "PLAYOFF"]).default("SCRAMBLE"),
  courseId: z.string(),
  holeNumbers: z.array(z.number().int().min(1).max(18)).min(1).max(18),
});

export const updateRoundSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  status: z.enum(["PENDING", "ACTIVE", "COMPLETE"]).optional(),
  courseId: z.string().optional(),
  holeNumbers: z.array(z.number().int().min(1).max(18)).min(1).max(18).optional(),
  longestDriveHole: z.number().int().min(1).max(18).nullable().optional(),
  closestToPinHole: z.number().int().min(1).max(18).nullable().optional(),
});

export const setTeamsSchema = z.object({
  teams: z
    .array(
      z.object({
        name: z.string().max(120).optional(),
        playerIds: z.array(z.string()).min(1).max(2),
      }),
    )
    .min(1),
});

export const scoreSchema = z.object({
  roundId: z.string(),
  teamId: z.string(),
  playerId: z.string().nullable().optional(), // set for playoff (per-player)
  holeNumber: z.number().int().min(1).max(18),
  strokes: z.number().int().min(1).max(20),
});

export const claimSchema = z.object({
  playerId: z.string(),
  distance: z.number().min(0).max(1000),
  unit: z.string().max(8).default("yds"),
});

export const chatSchema = z.object({
  body: z.string().min(1).max(2000),
  mentionPlayerIds: z.array(z.string()).max(16).optional(),
});
