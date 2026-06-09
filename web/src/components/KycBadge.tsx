// The header KYC status + verify entry point · #39
// Shows the acting wallet's on-chain KYC status (Verified / Unverified) and, when unverified, a
// "Verify" button that opens the onboarding modal. After approval it refetches so the badge flips to
// Verified live — the visible payoff of the onboarding → gauntlet → invest arc.
import { useEffect, useState, useCallback } from "react";
import { gql } from "../lib/graphqlClient.ts";
import { KYC_STATUS } from "../lib/kyc.ts";
import { Badge, Button } from "./primitives.tsx";
import { KycModal } from "./KycModal.tsx";

interface Status {
  verified: boolean;
  accredited: boolean;
  jurisdiction: string;
  frozen: boolean;
}

export function KycBadge(props: { wallet: string }): JSX.Element | null {
  const [status, setStatus] = useState<Status | null>(null);
  const [open, setOpen] = useState(false);

  const refetch = useCallback((): void => {
    void gql<{ kycStatus: Status }>(KYC_STATUS, { wallet: props.wallet })
      .then((d) => setStatus(d.kycStatus))
      .catch(() => setStatus(null));
  }, [props.wallet]);

  useEffect(() => {
    setStatus(null);
    refetch();
  }, [refetch]);

  if (status === null) return null;

  return (
    <>
      {status.frozen ? (
        <Badge tone="halt" title="This wallet is frozen">Frozen</Badge>
      ) : status.verified ? (
        <Badge tone="positive" title={`KYC verified · ${status.jurisdiction}${status.accredited ? " · accredited" : ""}`}>
          KYC&nbsp;✓
        </Badge>
      ) : (
        <span className="flex items-center gap-1.5">
          <Badge tone="warn" title="No KYC on file — invests will be rejected">Unverified</Badge>
          <Button variant="secondary" onClick={() => setOpen(true)}>Verify</Button>
        </span>
      )}
      {open ? (
        <KycModal
          wallet={props.wallet}
          onClose={() => setOpen(false)}
          onVerified={() => { refetch(); setTimeout(() => setOpen(false), 1200); }}
        />
      ) : null}
    </>
  );
}
