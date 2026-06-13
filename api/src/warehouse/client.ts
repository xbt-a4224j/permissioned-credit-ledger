// #63 warehouse client — the API's read-through to the Java data-platform sidecar (#51-#58).
// The warehouse owns the originator's full book + scoring (port 47100); the API proxies its ranked
// book + analytics so the UI talks to ONE GraphQL surface (#64). Bun's global fetch; typed to the
// warehouse DTOs. Book principal is a display dollar figure (not on-chain base-unit money).
const WAREHOUSE_URL = process.env.WAREHOUSE_URL ?? "http://localhost:47100";

export interface ScoreWeightsDto {
  credit: number;
  ret: number;
  duration: number;
  portfolio: number;
}

export interface RankedLoanDto {
  loanId: string;
  principal: number;
  ltvBps: number;
  dscrBps: number;
  couponBps: number;
  termMonths: number;
  state: string;
  propertyType: string;
  originator: string;
  tokenized: boolean;
  score: number;
  creditScore: number;
  returnScore: number;
  durationScore: number;
  portfolioScore: number;
}

export interface RankedBookDto {
  weights: ScoreWeightsDto;
  total: number;
  loans: RankedLoanDto[];
}

export interface AnalyticsBucketDto {
  label: string;
  count: number;
}

export interface AnalyticsDto {
  total: number;
  tokenized: number;
  avgLtvBps: number;
  avgDscrBps: number;
  byState: Record<string, number>;
  byPropertyType: Record<string, number>;
  byOriginator: Record<string, number>;
  ltvDistribution: AnalyticsBucketDto[];
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(new URL(path, WAREHOUSE_URL));
  if (!res.ok) {
    throw new Error(`warehouse ${path} -> ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

// #63 GET /book — ranked by score desc; untokenized only unless includeTokenized.
export function fetchRankedBook(opts: { limit?: number; offset?: number; includeTokenized?: boolean } = {}): Promise<RankedBookDto> {
  const params = new URLSearchParams({
    limit: String(opts.limit ?? 50),
    offset: String(opts.offset ?? 0),
    includeTokenized: String(opts.includeTokenized ?? false),
  });
  return getJson<RankedBookDto>(`/book?${params.toString()}`);
}

// #63 GET /book/analytics — concentration + distributions over the whole book.
export function fetchBookAnalytics(): Promise<AnalyticsDto> {
  return getJson<AnalyticsDto>("/book/analytics");
}
