// Money Layer (presentation) · wallet connect + ensureChain — the on/off-ramp at the UI edge · #25
// A thin viem wrapper over window.ethereum (EIP-1193). connect() requests accounts; ensureChain()
// switches/adds the target chain (Fuji 0xa869 or local anvil 0x7a69 from VITE_CHAIN_ID) and MUST be
// called before every mutation — a user on the wrong network would broadcast an invest to a chain
// the indexer never watches (silent divergence). No private keys touched here; the wallet signs.
import { useCallback, useEffect, useState } from "react";
import type { Address } from "viem";

// #25 the EIP-1193 provider surface we use (request only). window.ethereum, when present.
interface Eip1193 {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on?(event: string, handler: (...args: unknown[]) => void): void;
  removeListener?(event: string, handler: (...args: unknown[]) => void): void;
}

function provider(): Eip1193 | undefined {
  return (globalThis as unknown as { ethereum?: Eip1193 }).ethereum;
}

// #25 the target chain id (hex) the wallet must be on. Local anvil 0x7a69; Fuji 0xa869.
const TARGET_CHAIN_ID = (import.meta.env.VITE_CHAIN_ID ?? "0x7a69") as `0x${string}`;
const CHAIN_LABEL = (import.meta.env.VITE_CHAIN_LABEL ?? "Local") as "Fuji" | "Local";

// #25 the add-chain params used if the wallet doesn't yet know the target (error 4902 on switch).
const ADD_CHAIN_PARAMS: Record<string, unknown> = {
  chainId: TARGET_CHAIN_ID,
  chainName: CHAIN_LABEL === "Fuji" ? "Avalanche Fuji C-Chain" : "PCL Local (anvil)",
  nativeCurrency: { name: "AVAX", symbol: "AVAX", decimals: 18 },
  rpcUrls: [CHAIN_LABEL === "Fuji" ? "https://api.avax-test.network/ext/bc/C/rpc" : "http://localhost:18545"],
};

export interface WalletApi {
  address?: Address;
  chainId?: number;
  connect(): Promise<void>;
  ensureChain(): Promise<void>;
  // #34 set the active actor to a seeded demo identity (no browser wallet needed; the server signs).
  selectDemoIdentity(address: Address): void;
  // #34 true when the active address came from the demo picker rather than an injected wallet.
  isDemo: boolean;
}

export function useWallet(): WalletApi {
  const [address, setAddress] = useState<Address | undefined>(undefined);
  const [chainId, setChainId] = useState<number | undefined>(undefined);
  // #34 track whether the current actor came from the demo picker (no injected provider in play).
  const [isDemo, setIsDemo] = useState(false);

  // #34 pick a seeded identity as the actor — no provider required (the API server is the signer).
  const selectDemoIdentity = useCallback((a: Address): void => {
    setAddress(a);
    setIsDemo(true);
  }, []);

  // #25 connect: request accounts + read the current chain id. No-op (no throw) without a provider.
  const connect = useCallback(async (): Promise<void> => {
    const eth = provider();
    if (eth === undefined) throw new Error("No browser wallet detected. Use the demo identity picker, or install Core/MetaMask.");
    const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
    if (accounts[0] !== undefined) {
      setAddress(accounts[0].toLowerCase() as Address);
      setIsDemo(false);
    }
    const cid = (await eth.request({ method: "eth_chainId" })) as string;
    setChainId(Number(cid));
  }, []);

  // #25 ensureChain: switch to the target; add it first if the wallet doesn't know it (4902).
  const ensureChain = useCallback(async (): Promise<void> => {
    const eth = provider();
    // #34 demo actor (or no injected wallet): nothing to switch — the API server holds the signer
    // and broadcasts on the configured chain, so we skip the wallet network dance entirely.
    if (eth === undefined) return;
    try {
      await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: TARGET_CHAIN_ID }] });
    } catch (err) {
      if ((err as { code?: number }).code === 4902) {
        await eth.request({ method: "wallet_addEthereumChain", params: [ADD_CHAIN_PARAMS] });
      } else {
        throw err;
      }
    }
    setChainId(Number(TARGET_CHAIN_ID));
  }, []);

  // #25 track wallet-side account/chain changes so the UI never drifts from the live wallet state.
  useEffect(() => {
    const eth = provider();
    if (eth?.on === undefined) return;
    const onAccounts = (...a: unknown[]): void => {
      const accs = a[0] as string[];
      setAddress(accs[0] !== undefined ? (accs[0].toLowerCase() as Address) : undefined);
    };
    const onChain = (...a: unknown[]): void => setChainId(Number(a[0] as string));
    eth.on("accountsChanged", onAccounts);
    eth.on("chainChanged", onChain);
    return () => {
      eth.removeListener?.("accountsChanged", onAccounts);
      eth.removeListener?.("chainChanged", onChain);
    };
  }, []);

  // #25 build the api object omitting undefined keys (exactOptionalPropertyTypes).
  const api: WalletApi = { connect, ensureChain, selectDemoIdentity, isDemo };
  if (address !== undefined) api.address = address;
  if (chainId !== undefined) api.chainId = chainId;
  return api;
}
