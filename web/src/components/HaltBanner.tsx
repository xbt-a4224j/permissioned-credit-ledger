// The full-width HALT banner — accrual/distribution frozen · #26
// Raised when the recon engine HALTs (NavAnomaly row 9 / ReconMismatch row 10). Copy is keyed off
// REASON_META[code] (from #25) so wording is single-sourced; the banner explicitly states that
// accrual/distribution is frozen. Red, role=alert — impossible to miss from any view.
import type { HaltCode } from "../lib/reasonCodes.ts";
import { REASON_META } from "../lib/reasonCodes.ts";
import { Banner } from "./primitives.tsx";

export function HaltBanner(props: { code: HaltCode }): JSX.Element {
  const meta = REASON_META[props.code];
  const frozenClause =
    props.code === "NavAnomaly"
      ? "Accrual is frozen until the NAV mark reconciles."
      : "Distribution is halted; no claims will be paid until reconciliation clears.";
  return (
    <Banner tone="halt" title={`HALTED — ${meta.label}`}>
      {meta.blurb} {frozenClause}
    </Banner>
  );
}
