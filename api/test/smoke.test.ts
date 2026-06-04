// #2 trivial smoke test so the Bun/Vitest toolchain is "green on empty".
// Real GraphQL + reconciliation tests (incl. the fast-check replay property)
// arrive with their features (#20/#21, #18/#19).
import {expect, test} from "vitest";

import {API_NAME} from "../src/index.ts";

test("api workspace toolchain is wired", () => {
  expect(API_NAME).toBe("@pcl/api");
});
