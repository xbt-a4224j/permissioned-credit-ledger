// Money Layer (presentation) · seeded demo identities — the no-wallet actor picker · #34 (bug)
// Bug #34: "Connect wallet" was a dead no-op, and it isn't actually needed — the API server is the
// single signer (anvil account 0); the browser only supplies the ACTOR ADDRESS passed to a
// mutation. So the demo picks an actor from this list (one click, no extension) and every gauntlet
// row is reachable. These are the canonical anvil mnemonic accounts (indices 1..6) the deploy seeds
// as the six identities — addresses are deterministic, so they always match the seeded registry.
import type { Address } from "viem";

export interface DemoIdentity {
  label: string;
  address: Address;
  note: string;
}

// #34 the six seeded identities, in demo-narrative order (happy path -> rejections).
export const DEMO_IDENTITIES: DemoIdentity[] = [
  { label: "Accredited US #1", address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", note: "verified · accredited · US" },
  { label: "Accredited US #2", address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", note: "verified · accredited · US" },
  { label: "Reg-S non-US #1", address: "0x90F79bf6EB2c4f870365E785982E1f101E93b906", note: "verified · Reg-S non-US" },
  { label: "Reg-S non-US #2", address: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65", note: "verified · Reg-S non-US" },
  { label: "Unverified", address: "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc", note: "not verified — invest rejects NotEligible" },
  { label: "Frozen", address: "0x976EA74026E726554dB657fA54763abd0C3a0aa9", note: "verified · frozen — receiving rejects ReceiverFrozen" },
];
