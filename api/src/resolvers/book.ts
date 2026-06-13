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
  avgLtvBps: number;
  avgDscrBps: number;
  byState: Bucket[];
  byPropertyType: Bucket[];
  byOriginator: Bucket[];
  ltvDistribution: Bucket[];
}

export async function resolveBookAnalytics(): Promise<BookAnalyticsSource> {
  const a = await fetchBookAnalytics();
  const toBuckets = (m: Record<string, number>): Bucket[] =>
    Object.entries(m).map(([label, count]) => ({ label, count }));
  return {
    total: a.total,
    tokenized: a.tokenized,
    avgLtvBps: a.avgLtvBps,
    avgDscrBps: a.avgDscrBps,
    byState: toBuckets(a.byState),
    byPropertyType: toBuckets(a.byPropertyType),
    byOriginator: toBuckets(a.byOriginator),
    ltvDistribution: a.ltvDistribution,
  };
}
