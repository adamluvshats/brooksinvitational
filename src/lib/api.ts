import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { HttpError } from "./auth";

/** Wrap a route handler so thrown HttpError/ZodError become clean JSON responses. */
export function handle<T>(fn: () => Promise<T>): Promise<NextResponse> {
  return fn()
    .then((data) => NextResponse.json(data ?? { ok: true }))
    .catch((err) => {
      if (err instanceof HttpError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      if (err instanceof ZodError) {
        return NextResponse.json(
          { error: "Invalid request", details: err.flatten() },
          { status: 400 },
        );
      }
      console.error(err);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    });
}

export { HttpError };
