// Money Layer (presentation) · the single GraphQL client + typed error boundary · #24
// One graphql-request client pointed at VITE_API_URL. The typed-revert contract (#21) lives in
// extensions.code; gql() surfaces that raw code on a GraphqlCodeError so the UI can branch on a
// machine-checkable code, never a stringly RPC message. #25 narrows `code` to the ReasonCode union
// and renders a ReasonBadge; here it stays a string|null so #24 (read-only) has no #25 dependency.
import { GraphQLClient } from "graphql-request";

// #24 the API origin. Vite injects import.meta.env at build; default to the fixed API port (41990).
const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:41990/graphql";

export const gqlClient = new GraphQLClient(API_URL);

// #24 a typed GraphQL error: carries the machine-checkable extensions.code (raw string; #25 narrows
// it to ReasonCode). `code` is null for an untyped (e.g. network) failure.
export class GraphqlCodeError extends Error {
  constructor(
    message: string,
    readonly code: string | null,
  ) {
    super(message);
    this.name = "GraphqlCodeError";
  }
}

// #24 extract the first extensions.code from a graphql-request error response, if any.
export function extractCode(err: unknown): string | null {
  const response = (err as { response?: { errors?: { extensions?: { code?: unknown } }[] } }).response;
  const raw = response?.errors?.[0]?.extensions?.code;
  return typeof raw === "string" ? raw : null;
}

// #24 run a query/mutation; on a typed-code error throw GraphqlCodeError so callers branch on the
// code (the #25 invest/claim flows) instead of parsing strings.
export async function gql<TData, TVars extends object = object>(doc: string, vars?: TVars): Promise<TData> {
  try {
    return await gqlClient.request<TData>(doc, vars);
  } catch (err) {
    const code = extractCode(err);
    const message = err instanceof Error ? err.message : "request failed";
    throw new GraphqlCodeError(message, code);
  }
}
