import type { RegisterInput } from "../types";

/**
 * Swap this later to hit your real API.
 * Keep signature stable so call sites don’t change.
 */
export async function register(_input: RegisterInput): Promise<void> {
  // Example:
  // const res = await fetch(`${API_BASE}/auth/register`, {
  //   method: "POST",
  //   headers: { "Content-Type": "application/json" },
  //   body: JSON.stringify(_input),
  // });
  // if (!res.ok) throw new Error("Registration failed");

  await new Promise(resolve => setTimeout(resolve, 300));
}
