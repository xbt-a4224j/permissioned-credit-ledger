// The typed reason-code badge · #25
// Renders a ReasonCode as a pill colored by REASON_META[code].tone (block = compliance/reserve
// revert; halt = engine HALT), with the blurb as a tooltip. The single place a failure reason
// reaches the screen — always typed, never a raw error string.
import type { ReasonCode } from "../lib/reasonCodes.ts";
import { REASON_META } from "../lib/reasonCodes.ts";
import { Badge } from "./primitives.tsx";

export function ReasonBadge(props: { code: ReasonCode }): JSX.Element {
  const meta = REASON_META[props.code];
  return (
    <Badge tone={meta.tone} title={meta.blurb}>
      {meta.label}
    </Badge>
  );
}
