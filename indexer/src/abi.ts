// On-Chain Layer · CreditToken ABI for typed log decoding · #16
// The indexer decodes CreditToken events off this single source-of-truth ABI. The full
// compiled artifact is copied by scripts/copy_abis.sh (#13) into ./abi/CreditToken.json —
// importing that gives us the bytecode too, but a JSON import erases the `as const` literal
// types viem needs for typed decoding. So we ALSO pin the 4 event fragments inline `as const`
// here (the LANDMINE: ABI drift turns a typed event into a mis-parsed `any`). A test asserts
// these inline fragments are byte-identical to the artifact, so they can never silently drift.
import artifact from "./abi/CreditToken.json" with { type: "json" };

export const CREDIT_TOKEN_ARTIFACT = artifact;

// #16 the exact events the read model projects (matrix rows 1,2 PositionOpened; transfers;
// row 7 InterestClaimed; status replay LoanStatusChanged). `Transfer` is the ERC20 standard
// event the gauntlet still emits on mint/transfer. Pinned `as const` for viem inference.
export const CREDIT_TOKEN_EVENTS = [
  {
    type: "event",
    name: "PositionOpened",
    inputs: [
      { name: "holder", type: "address", indexed: true },
      { name: "loanId", type: "uint256", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "InterestClaimed",
    inputs: [
      { name: "holder", type: "address", indexed: true },
      { name: "loanId", type: "uint256", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "AccrualFrozen",
    inputs: [{ name: "loanId", type: "uint256", indexed: true }],
    anonymous: false,
  },
  {
    type: "event",
    name: "LoanStatusChanged",
    inputs: [
      { name: "loanId", type: "uint256", indexed: true },
      { name: "status", type: "uint8", indexed: false },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "value", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
] as const;

// #16 on-chain LoanStatus enum order (ICreditToken.LoanStatus) -> off-chain string. The
// uint8 in LoanStatusChanged indexes this array; out-of-range is a hard error (ABI drift).
export const LOAN_STATUS_BY_INDEX = ["PERFORMING", "DELINQUENT", "DEFAULT"] as const;
