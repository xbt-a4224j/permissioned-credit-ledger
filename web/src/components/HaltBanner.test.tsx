// #26 HaltBanner — both halt codes render a red banner that states accrual/distribution is frozen.
import { afterEach, describe, expect, it } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { HaltBanner } from "./HaltBanner.tsx";

afterEach(cleanup);

describe("HaltBanner", () => {
  it("renders the NavAnomaly halt and states accrual is frozen", () => {
    render(<HaltBanner code="NavAnomaly" />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/HALTED/);
    expect(alert).toHaveTextContent(/Accrual is frozen/);
  });

  it("renders the ReconMismatch halt and states distribution is halted", () => {
    render(<HaltBanner code="ReconMismatch" />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/HALTED/);
    expect(alert).toHaveTextContent(/Distribution is halted/);
  });
});
