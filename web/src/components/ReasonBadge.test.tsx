// #25 ReasonBadge — every ReasonCode renders its label + tooltip, colored by tone.
// Renders all 8 codes and asserts the single-sourced label (REASON_META) appears and the blurb is
// exposed as the tooltip (title) so the failure reason is always typed and human-legible.
import { describe, expect, it, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ReasonBadge } from "./ReasonBadge.tsx";
import { REASON_CODES, REASON_META } from "../lib/reasonCodes.ts";

afterEach(cleanup);

describe("ReasonBadge", () => {
  it("renders the typed label + blurb tooltip for every ReasonCode", () => {
    for (const code of REASON_CODES) {
      const { unmount } = render(<ReasonBadge code={code} />);
      const meta = REASON_META[code];
      const el = screen.getByText(meta.label);
      expect(el).toBeInTheDocument();
      expect(el).toHaveAttribute("title", meta.blurb);
      unmount();
    }
  });
});
