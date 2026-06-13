// Origination — the data-platform tab · #69-#72
// The operator view that tells the whole story without narration: the full origination pipeline,
// scored and ranked for tokenization, with a one-click Tokenize that deploys a real CreditToken
// on-chain (it then appears in the Marketplace). Hero stats frame "whole book vs tokenized tip";
// the ranked table makes the score (and what drives it) visible; the live ticker is the servicing
// firehose the reconciliation engine reconciles against.
import { useState } from "react";
import { BOOK_QUERY, BOOK_ANALYTICS_QUERY } from "../queries.ts";
import { TOKENIZE_MUTATION } from "../lib/mutations.ts";
import { useQuery } from "../lib/useQuery.ts";
import { gql } from "../lib/graphqlClient.ts";
import { fmtLtv, fmtDscr } from "../lib/format.ts";
import { logAction } from "../lib/actionLog.ts";
import { ServicingTicker } from "../components/ServicingTicker.tsx";
import { Card, DataTable, Button, Badge, Banner, StatPill, LoadingState, ErrorState } from "../components/primitives.tsx";
import type { Column } from "../components/primitives.tsx";

interface BookWeights { credit: number; ret: number; duration: number; portfolio: number }
interface BookLoanRaw {
  loanId: string; principal: number; ltvBps: number; dscrBps: number; couponBps: number; termMonths: number;
  state: string; propertyType: string; originator: string; tokenized: boolean;
  score: number; creditScore: number; returnScore: number; durationScore: number; portfolioScore: number;
}
interface BookRaw { book: { weights: BookWeights; total: number; loans: BookLoanRaw[] } }
interface Bucket { label: string; count: number }
interface AnalyticsRaw {
  bookAnalytics: { total: number; tokenized: number; totalPrincipalM: number; tokenizedPrincipalM: number;
    avgLtvBps: number; avgDscrBps: number; avgCouponBps: number;
    exposureByType: Bucket[]; ltvDistribution: Bucket[]; scoreDistribution: Bucket[] };
}

const fmtM = (n: number): string => (n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${Math.round(n / 1000)}k`);
const fmtPct = (bps: number): string => `${(bps / 100).toFixed(1)}%`;
const pct = (w: number): string => `${Math.round(w * 100)}%`;
const scoreTone = (s: number): string => (s >= 85 ? "bg-emerald-500" : s >= 70 ? "bg-amber-400" : "bg-slate-400");

// a compact horizontal bar list for the concentration / distribution panels (#72).
function BarList(props: { title: string; buckets: Bucket[]; format?: (n: number) => string }): JSX.Element {
  const fmt = props.format ?? ((n: number): string => n.toLocaleString());
  const max = Math.max(...props.buckets.map((b) => b.count), 1);
  return (
    <div>
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">{props.title}</div>
      <div className="space-y-1.5">
        {props.buckets.map((b) => (
          <div key={b.label} className="flex items-center gap-2 text-xs">
            <span className="w-24 shrink-0 truncate text-slate-600">{b.label}</span>
            <div className="h-2 flex-1 overflow-hidden rounded bg-slate-100">
              <div className="h-full bg-navy-600" style={{ width: `${(b.count / max) * 100}%` }} />
            </div>
            <span className="w-16 text-right font-tabular tabular-nums text-slate-500">{fmt(b.count)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// #58 $ millions -> a compact "$280M" / "$1.4B" exposure label for the book-admin bars.
const fmtExposure = (m: number): string => (m >= 1000 ? `$${(m / 1000).toFixed(1)}B` : `$${m.toLocaleString()}M`);

export function OriginationView(): JSX.Element {
  // #66 includeTokenized so a loan stays in the book table after it's tokenized (shown with a
  // "Tokenized" badge instead of dropping out); it just graduates from a Tokenize action to live.
  const book = useQuery<BookRaw, BookRaw["book"]>(BOOK_QUERY, (r) => r.book, { limit: 12, offset: 0, includeTokenized: true });
  const analytics = useQuery<AnalyticsRaw, AnalyticsRaw["bookAnalytics"]>(BOOK_ANALYTICS_QUERY, (r) => r.bookAnalytics);
  const [tokenizing, setTokenizing] = useState<string | null>(null);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  async function tokenize(loanId: string): Promise<void> {
    setTokenizing(loanId);
    setResult(null);
    logAction({ action: "tokenize", warehouseLoanId: loanId });
    try {
      const res = await gql<{ tokenizeLoan: { loanId: string; tokenAddress: string } }>(
        TOKENIZE_MUTATION, { warehouseLoanId: loanId });
      setResult({
        ok: true,
        msg: `Tokenized ${loanId} → deployed on-chain as loan #${res.tokenizeLoan.loanId} (${res.tokenizeLoan.tokenAddress.slice(0, 10)}…). Now live in the Marketplace.`,
      });
      book.reload();
      analytics.reload();
    } catch (err) {
      setResult({ ok: false, msg: err instanceof Error ? err.message : "Tokenize failed." });
    } finally {
      setTokenizing(null);
    }
  }

  const w = book.data?.weights;
  const rows = (book.data?.loans ?? []).map((l, i) => ({ ...l, rank: i + 1 }));
  type Row = (typeof rows)[number];

  const columns: Column<Row>[] = [
    { key: "rank", header: "#", render: (l) => <span className="font-tabular tabular-nums text-slate-400">{l.rank}</span> },
    { key: "loan", header: "Loan", render: (l) => <span className="font-tabular text-slate-700">{l.loanId}</span> },
    { key: "principal", header: "Principal", align: "right", render: (l) => fmtM(l.principal) },
    { key: "type", header: "Type", render: (l) => <span className="text-slate-600">{l.propertyType}</span> },
    { key: "ltv", header: "LTV", align: "right", render: (l) => fmtLtv(l.ltvBps) },
    { key: "dscr", header: "DSCR", align: "right", render: (l) => fmtDscr(l.dscrBps) },
    { key: "coupon", header: "Coupon", align: "right", render: (l) => fmtPct(l.couponBps) },
    {
      key: "score",
      header: "Score",
      align: "right",
      render: (l) => (
        <div
          className="flex items-center justify-end gap-2"
          title={`credit ${l.creditScore.toFixed(0)} · return ${l.returnScore.toFixed(0)} · duration ${l.durationScore.toFixed(0)} · fit ${l.portfolioScore.toFixed(0)}`}
        >
          <div className="h-1.5 w-16 overflow-hidden rounded bg-slate-100">
            <div className={`h-full ${scoreTone(l.score)}`} style={{ width: `${l.score}%` }} />
          </div>
          <span className="w-10 font-tabular font-semibold tabular-nums text-navy-900">{l.score.toFixed(1)}</span>
        </div>
      ),
    },
    {
      key: "action",
      header: "",
      align: "right",
      render: (l) =>
        l.tokenized ? (
          <Badge tone="positive" title="Already deployed on-chain — live in the Marketplace">Tokenized</Badge>
        ) : (
          <Button
            variant="primary"
            disabled={tokenizing !== null}
            title="Deploy a real CreditToken for this loan on-chain"
            onClick={() => { void tokenize(l.loanId); }}
          >
            {tokenizing === l.loanId ? "Deploying…" : "Tokenize"}
          </Button>
        ),
    },
  ];

  return (
    <section aria-labelledby="origination-heading">
      <div className="mb-6">
        <h2 id="origination-heading" className="text-xl font-semibold text-navy-900">Origination</h2>
        <p className="text-sm text-slate-500">
          Score the origination pipeline and tokenize the strongest candidates on-chain — one click deploys a real security token that lands in the Marketplace.
        </p>
      </div>

      {/* hero stats — the whole book vs the tokenized tip */}
      {analytics.data !== null && (
        <div className="mb-6 flex flex-wrap items-center gap-6 rounded-lg border border-slate-200 bg-white px-5 py-4">
          <StatPill label="Pipeline" value={`${analytics.data.total.toLocaleString()} loans`} tone="navy" />
          <StatPill label="Book exposure" value={fmtExposure(analytics.data.totalPrincipalM)} tone="navy" />
          <StatPill label="Tokenized on-chain" value={`${analytics.data.tokenized} · ${fmtExposure(analytics.data.tokenizedPrincipalM)}`} />
          <StatPill label="Avg LTV" value={fmtLtv(Math.round(analytics.data.avgLtvBps))} />
          <StatPill label="Avg DSCR" value={fmtDscr(Math.round(analytics.data.avgDscrBps))} />
          <StatPill label="Avg coupon" value={fmtPct(analytics.data.avgCouponBps)} />
        </div>
      )}

      {result !== null && (
        <div className="mb-4">
          <Banner tone={result.ok ? "positive" : "halt"} title={result.ok ? "On-chain ✓" : "Tokenize failed"}>
            {result.msg}
          </Banner>
        </div>
      )}

      {/* the ranked candidates — the star */}
      <Card className="mb-6 p-0">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div className="text-sm font-semibold text-navy-900">Top tokenization candidates</div>
          {w !== undefined && (
            <div className="text-xs text-slate-400">
              Score = credit {pct(w.credit)} · return {pct(w.ret)} · duration {pct(w.duration)} · fit {pct(w.portfolio)}
            </div>
          )}
        </div>
        {book.loading ? (
          <LoadingState label="Scoring the book…" />
        ) : book.error !== null ? (
          <ErrorState message={book.error} onRetry={book.reload} />
        ) : (
          <DataTable columns={columns} rows={rows} rowKey={(l) => l.loanId} emptyLabel="No candidates." />
        )}
      </Card>

      {/* analytics + the live servicing firehose */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="flex flex-col gap-5">
          <div className="text-sm font-semibold text-navy-900">Book analytics</div>
          {analytics.data !== null ? (
            <>
              <BarList title="$ exposure by property type" buckets={analytics.data.exposureByType} format={fmtExposure} />
              <BarList title="Score distribution (tokenization-ready)" buckets={analytics.data.scoreDistribution} />
              <BarList title="LTV distribution" buckets={analytics.data.ltvDistribution} />
            </>
          ) : (
            <LoadingState label="Loading analytics…" />
          )}
        </Card>
        <ServicingTicker />
      </div>
    </section>
  );
}
