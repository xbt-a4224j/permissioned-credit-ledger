// #64 book resolvers — proxy the warehouse client (#63) to the GraphQL surface. The ranked book
// passes through (DTO fields match the BookLoan type); analytics maps the warehouse's keyed maps into
// labelled buckets the GraphQL schema can express.
import { fetchRankedBook, fetchBookAnalytics, type RankedBookDto } from "../warehouse/client.ts";

export function resolveBook(limit: number, offset: number, includeTokenized: boolean): Promise<RankedBookDto> {
  return fetchRankedBook({ limit, offset, includeTokenized });
}

interface Bucket {
  label: string;
  count: number;
}

export interface BookAnalyticsSource {
  total: number;
  tokenized: number;
  totalPrincipalM: number;
  tokenizedPrincipalM: number;
  avgLtvBps: number;
  avgDscrBps: number;
  avgCouponBps: number;
  byState: Bucket[];
  byPropertyType: Bucket[];
  byOriginator: Bucket[];
  exposureByType: Bucket[];
  ltvDistribution: Bucket[];
  scoreDistribution: Bucket[];
}

export async function resolveBookAnalytics(): Promise<BookAnalyticsSource> {
  const a = await fetchBookAnalytics();
  const toBuckets = (m: Record<string, number>): Bucket[] =>
    Object.entries(m).map(([label, count]) => ({ label, count }));
  // #58 the warehouse maps are unordered (HashMap); sort $ exposure desc so the biggest concentration leads.
  const sortedDesc = (m: Record<string, number>): Bucket[] => toBuckets(m).sort((x, y) => y.count - x.count);
  return {
    total: a.total,
    tokenized: a.tokenized,
    totalPrincipalM: a.totalPrincipalM,
    tokenizedPrincipalM: a.tokenizedPrincipalM,
    avgLtvBps: a.avgLtvBps,
    avgDscrBps: a.avgDscrBps,
    avgCouponBps: a.avgCouponBps,
    byState: toBuckets(a.byState),
    byPropertyType: sortedDesc(a.byPropertyType),
    byOriginator: toBuckets(a.byOriginator),
    exposureByType: sortedDesc(a.exposureByType),
    ltvDistribution: a.ltvDistribution,
    scoreDistribution: a.scoreDistribution,
  };
}
