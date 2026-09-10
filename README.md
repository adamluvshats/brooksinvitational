# ⛳ Brooks Invitational

A live-scoring web app for the Brooks Invitational golf tournament — built for its
unusual format: round-robin 2-man mixed scrambles, a tier-based handicap system,
hole-by-hole points, Longest Drive / Closest to Pin contests, a seeded stroke-play
playoff, and in-round smack talk with player tagging.

Built with **Next.js (App Router) + Prisma + Postgres**, deployable on **Vercel**.
"Live" updates are done with lightweight polling (every few seconds), so there is
no websocket infrastructure to run.

---

## The format & rules (what the app encodes)

- **Players:** 8 to 16. Each has a handicap **class**: Scratch (0), A (5), B (10),
  C (15), D (20) over an 18-hole course.
- **Holes** carry a **stroke index 1–18** (1 = hardest, 18 = easiest). A handicap of
  `H` gets a stroke on every hole whose index ≤ `H` (wrapping for `H > 18`). This is
  why mapping hole difficulty correctly matters — a 15-handicap might get 8 strokes on
  the front and 7 on the back depending on where the hard holes fall.
- **Scramble team handicap:** partners *don't stack* — by default the team plays off
  the **higher** partner's handicap (a 5 & 10 pairing → strokes on the 10 hardest
  holes; a 10 & 15 pairing → the 15 hardest). Configurable per tournament
  (`MAX` / `DIFFERENCE` / `AVERAGE`).
- **Scoring a hole:** teams enter their **true (gross)** score. The app subtracts
  handicap strokes to get a **net** score and decides the hole automatically. Every
  player on the team(s) with the lowest net **scores 1 point**. Ties split — all tied
  teams' players each get the point (a 3-way tie → 6 players each +1).
- **Per round:** the admin designates one **par-5 Longest Drive** hole and one
  **par-3 Closest to Pin** hole. Players post/update the current leader live (name +
  distance) from a dropdown of registered players. Each holder earns **1 point** for
  the round. → **Max 11 points per round** (9 holes + LD + CTP).
- **7 scramble rounds** round-robin the partners, then an **8th playoff round** seeds
  players by total points and pairs them **1v2, 3v4, 5v6, 7v8**. The playoff is
  **stroke play with handicaps still applied** — a 20-handicap can win their match on
  their own ball. The winner of a pair takes the **higher** of that pair's two
  positions, so a player can climb at most one slot (a #4 can reach 3rd, never 1st).
- **Roles:** **Administrator** (site-wide, can change anything), **Tournament admin**
  (can edit any hole score / manage their tournament), **Player** (only their own
  team's scores and their own profile).

The scoring engine is pure and unit-tested — see `src/lib/scoring.ts` and
`src/lib/scoring.test.ts` (`npm test`).

---

## Local development

### 1. Prerequisites
- Node.js 18.18+ (or 20+)
- A Postgres database. Any provider works — [Neon](https://neon.tech),
  [Vercel Postgres](https://vercel.com/storage/postgres), or
  [Supabase](https://supabase.com) all hand you a connection string.

### 2. Install & configure
```bash
npm install
cp .env.example .env
# edit .env and set DATABASE_URL and AUTH_SECRET (generate one with: openssl rand -base64 48)
```

### 3. Set up the database
```bash
npx prisma migrate deploy   # apply the schema
npm run db:seed             # optional: demo tournament + test logins (all pw: brooks123)
```
(For iterating on the schema during development, use `npx prisma migrate dev`.)

### 4. Run
```bash
npm run dev
# open http://localhost:3000
```

The **first account you register becomes the site administrator.** After that, create
a tournament (you become its tournament admin), add players, build a course's 18 holes,
create rounds, set the pairings, designate LD/CTP holes, and play.

---

## Deploying to Vercel

1. Push this repo to GitHub.
2. Import it into Vercel.
3. Add environment variables in the Vercel project settings:
   - `DATABASE_URL` — your Postgres connection string (use the **pooled** URL).
   - `DIRECT_URL` — a direct (non-pooled) connection, if your provider distinguishes
     them (Neon/Supabase do); used for migrations. Falls back to `DATABASE_URL`.
   - `AUTH_SECRET` — a long random string.
   - `RESEND_API_KEY`, `MAIL_FROM`, `APP_URL` — for confirmation & reset emails
     (see [Email (Resend)](#email-resend) below). Optional; email is skipped if unset.
4. The `build` script runs `prisma generate` automatically. To apply migrations on
   deploy, either run `npx prisma migrate deploy` from your machine against the prod
   DB once, or add it to the Vercel build command
   (`prisma migrate deploy && prisma generate && next build`).

---

## How "live" works

Scoreboard, scorecard, and chat views poll the API every 3–4 seconds via SWR, so every
group sees each other's scores and trash talk update on their own devices without a
manual refresh. There's no realtime server to operate — it just works on Vercel's
serverless functions.

## Email (Resend)

Transactional email is sent via [Resend](https://resend.com). Two messages are sent:

- **Welcome / confirmation** — on registration (`POST /api/auth/register`), a
  best-effort welcome email is sent. A mail failure never blocks sign-up.
- **Password reset** — `POST /api/auth/request-reset` stores a one-hour token and
  emails a `${APP_URL}/reset?token=…` link; the reset page pre-fills the token.

Configure these env vars (see `.env.example`):

- `RESEND_API_KEY` — your Resend API key (Resend → API Keys; starts with `re_`).
- `MAIL_FROM` — a From address on a domain you've **verified in Resend**, e.g.
  `Brooks Invitational <noreply@brooksinvitational.com>`.
- `APP_URL` — the app's public URL, used to build links in the emails.

**Domain setup:** add `brooksinvitational.com` in Resend → Domains and publish the
DNS records it gives you (SPF/DKIM). Until the domain is verified you can only send
from `onboarding@resend.dev` or to your own account address.

If `RESEND_API_KEY` is unset, sending is skipped; in non-production the reset API
returns the token directly so the flow stays testable. The send logic lives in
`src/lib/email.ts`.

---

## Landing page & past champions

The logged-out home page is a public overview: a hero, the live leaderboard of the most
recent tournament (served without auth from `/api/public/featured`), a feature breakdown,
the tournament rules, and a **Hall of Champions**. Edit `src/lib/history.ts` to fill in
your real winners back to 2020 — any tournament you run in the app and mark **COMPLETE**
is added automatically from its final standings.

## Project layout

```
prisma/
  schema.prisma        # Tournament, Course, Hole, Round, Team, Player, scores, chat…
  migrations/          # initial migration (prisma migrate deploy)
  seed.ts              # demo tournament
src/
  lib/
    scoring.ts         # pure scoring engine (handicaps, hole points, playoff)
    scoring.test.ts    # unit tests for the rules above
    tournament.ts      # loads a tournament from the DB and computes its live state
    auth.ts            # JWT cookie sessions + bcrypt passwords
    permissions.ts     # role checks (admin / tournament admin / player)
  app/
    api/…              # REST route handlers
    tournaments/[id]/  # leaderboard · scorecard · chat · admin tabs
    login · register · reset
  components/           # header, score cell, LD/CTP claim, admin editors
```

## Scripts
- `npm run dev` — dev server
- `npm run build` / `npm start` — production build & serve
- `npm test` — run the scoring engine unit tests
- `npm run db:seed` — seed the demo tournament
- `npx prisma studio` — browse the database
