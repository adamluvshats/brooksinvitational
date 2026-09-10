import { handle } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  return handle(async () => {
    const user = await getCurrentUser();
    if (!user) return { user: null };
    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
      },
    };
  });
}
