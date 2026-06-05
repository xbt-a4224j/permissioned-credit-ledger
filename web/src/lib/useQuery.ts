// Money Layer (presentation) · a tiny async-query hook with typed loading/error/empty states · #24
// No data-fetching library (scope): one hook that runs a gql() call, decodes BigIntStr money fields
// to bigint via a caller-supplied mapper, and exposes the {loading, error, data} the views render
// clean empty/loading/error states from. Re-runs when `vars` (serialized) changes.
import { useEffect, useRef, useState } from "react";
import { gql } from "./graphqlClient.ts";

export interface QueryState<T> {
  loading: boolean;
  error: string | null;
  data: T | null;
  reload: () => void;
}

// #24 run `doc` with `vars`, map the raw response, and surface loading/error/data. `map` decodes
// the wire shape (BigIntStr strings) into the bigint-carrying view models (types.ts).
export function useQuery<TRaw, TData, TVars extends object = object>(
  doc: string,
  map: (raw: TRaw) => TData,
  vars?: TVars,
): QueryState<TData> {
  const [state, setState] = useState<{ loading: boolean; error: string | null; data: TData | null }>({
    loading: true,
    error: null,
    data: null,
  });
  const [nonce, setNonce] = useState(0);
  const varsKey = JSON.stringify(vars ?? {});
  const mapRef = useRef(map);
  mapRef.current = map;

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    gql<TRaw, TVars>(doc, vars)
      .then((raw) => {
        if (!cancelled) setState({ loading: false, error: null, data: mapRef.current(raw) });
      })
      .catch((err: unknown) => {
        if (!cancelled) setState({ loading: false, error: err instanceof Error ? err.message : "request failed", data: null });
      });
    return () => {
      cancelled = true;
    };
    // deps: doc/varsKey/nonce drive re-fetch; vars/map are read via closure + ref (intentional).
  }, [doc, varsKey, nonce]);

  return { ...state, reload: () => setNonce((n) => n + 1) };
}
