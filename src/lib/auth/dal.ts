import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { validateSession } from "./session";

/**
 * Data access layer guard. Every page and server action under the app calls this,
 * so access never relies on the proxy redirect alone.
 */
export const isAuthenticated = cache(async () => validateSession());

export async function requireAdmin(): Promise<void> {
  if (!(await isAuthenticated())) {
    redirect("/login");
  }
}
