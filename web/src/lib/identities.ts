// Seeded demo identities — the no-wallet actor picker · #34 (bug) / #66
// Bug #34: "Connect wallet" was a dead no-op, and it isn't actually needed — the API server is the
// single signer (anvil account 0); the browser only supplies the ACTOR ADDRESS passed to a
// mutation. So the demo picks an actor from this list (one click, no extension). These are the
// canonical anvil mnemonic accounts the deploy seeds as the three identities (#66 verified-only) —
// addresses are deterministic, so they always match the seeded registry.
import type { Address } from "viem";

export interface DemoIdentity {
  label: string;
  address: Address;
  note: string;
}

// #34/#66 the three seeded identities, in demo-narrative order (verified holders -> the rejection).
export const DEMO_IDENTITIES: DemoIdentity[] = [
  { label: "Verified investor #1", address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", note: "KYC-verified · can hold the token" },
  { label: "Verified investor #2", address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", note: "KYC-verified · can hold the token" },
  { label: "Unverified wallet", address: "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc", note: "not verified — investing reverts ReceiverNotVerified" },
];
