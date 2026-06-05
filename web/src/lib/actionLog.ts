// #39 action logger — fire-and-forget POST to the API /log endpoint.
// Captures every user/product action (invest, claim, transfer, identity switch, demo triggers,
// tab navigation) so the admin Activity Log panel shows a full audit trail of the demo session.
const API_BASE = (import.meta.env.VITE_API_URL ?? "http://localhost:41990/graphql").replace(/\/graphql\/?$/, "");

// Use a loose object type so callers can spread arbitrary fields without fighting exactOptionalPropertyTypes.
export type ActionEntry = { action: string } & Record<string, unknown>;

// #39 post one entry — never awaited by callers so it never blocks the UI.
export function logAction(entry: ActionEntry): void {
  void fetch(`${API_BASE}/log`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(entry),
  }).catch(() => { /* swallow — log failure must never affect the UX */ });
}
