import { prisma } from "./prisma";
import type { User } from "@prisma/client";

export interface TournamentAccess {
  siteAdmin: boolean;
  /** The user's membership in this tournament, if any. */
  membership: { id: string; role: "TOURNAMENT_ADMIN" | "PLAYER" } | null;
  isTournamentAdmin: boolean;
  /** Can edit courses, players, rounds, settings, advance the tournament. */
  canManage: boolean;
  /** Can edit any hole score in this tournament. */
  canEditAnyScore: boolean;
}

export async function getTournamentAccess(
  user: Pick<User, "id" | "role">,
  tournamentId: string,
): Promise<TournamentAccess> {
  const siteAdmin = user.role === "ADMIN";
  const membership = await prisma.tournamentPlayer.findUnique({
    where: { tournamentId_userId: { tournamentId, userId: user.id } },
    select: { id: true, role: true },
  });
  const isTournamentAdmin = membership?.role === "TOURNAMENT_ADMIN";
  return {
    siteAdmin,
    membership: membership ?? null,
    isTournamentAdmin,
    canManage: siteAdmin || isTournamentAdmin,
    canEditAnyScore: siteAdmin || isTournamentAdmin,
  };
}

/**
 * Whether `user` may edit scores for `teamId`. Site/tournament admins may edit
 * anything; a player may only edit a team they are a member of.
 */
export async function canEditTeamScore(
  access: TournamentAccess,
  teamId: string,
): Promise<boolean> {
  if (access.canEditAnyScore) return true;
  if (!access.membership) return false;
  // membership.id is the TournamentPlayer id — a player may edit a team they're on.
  const member = await prisma.teamMember.findFirst({
    where: { teamId, playerId: access.membership.id },
    select: { id: true },
  });
  return Boolean(member);
}
