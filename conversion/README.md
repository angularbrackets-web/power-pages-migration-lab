# conversion

The C# rules in `legacy-logic/` ported to plain JavaScript, with a check that
both implementations give the same answers on the same test vectors.

The port was drafted with AI assistance (Claude Code) and checked against the
shared vectors. Passing the vectors is the evidence, not the authorship.

## Files

| Path | What it is |
|------|-----------|
| `js/rules.js` | The port. One file, no dependencies. Works in a browser (global `NorthbankRules`) and in Node (`require`). Rule IDs are in the comments. |
| `js/rules.test.js` | `node --test` suite. Loads `legacy-logic/test-vectors/*.json` and checks every case. |
| `parity/run-parity.sh` | Runs `dotnet test` and the JS tests, then writes the report. |
| `parity/build-report.js` | Builds `parity/parity-report.md` from the C# TRX output and the JS results. |
| `parity/parity-report.md` | One row per vector: C# result, JS result, match. |

## Where each rule would live in Power Pages

Client-side JavaScript on a Power Pages form can be bypassed (browser dev
tools, a direct call to the Web API), so it is only for fast feedback. Anything
that must be trusted has to be enforced again on the server: server logic, a
Dataverse plugin, or a Power Automate flow. Liquid is for display only.

| Rule | What | Client JS (UX) | Trusted enforcement | Liquid |
|------|------|----------------|---------------------|--------|
| E1 | Applicant 18+ | Yes, early message | Yes, eligibility | No |
| E2 | Registry number format | Yes | Yes | No |
| E3 | Over 500 attendees needs an organization | Yes | Yes | No |
| V1 | Lead time 21/45 days | Yes | Yes | Show the earliest date |
| V2 | Duration, 3 days max | Yes | Yes | No |
| V3 | Liquor licence required | Yes, show/hide field | Yes | No |
| V4 | Phone and postal code format | Yes, format as typed | Yes, normalise on save | No |
| F1-F5 | Fee calculation | Preview only | Yes, calculate and store the fee | Show the stored fee |
| S1 | Status transitions by role | Hide buttons | Yes, plugin or flow checks role and transition | Show status text |

Rules in the "trusted" column can reuse `rules.js` as is if the server
logic runs JavaScript. A Dataverse plugin is C# and can use the original
library directly.

## Parity method

1. The 60 vectors in `legacy-logic/test-vectors/` are the contract. Each is
   `{ id, rule, input, expected, note }`.
2. The xUnit tests run them against the C# library (61 tests: 60 vectors plus
   one check that the vector set is well formed).
3. `rules.test.js` runs the same files against `rules.js` (64 tests: 60
   vectors, a well-formedness check, and rounding tests described below).
4. `run-parity.sh` runs both and writes `parity-report.md`. Current result:
   60 of 60 vectors match.

Run it with:

```
export DOTNET_ROOT=$HOME/.dotnet PATH="$PATH:$HOME/.dotnet"
conversion/parity/run-parity.sh
```

Or only the JS side: `node --test conversion/js/rules.test.js`.

## Money and rounding (F5)

C# uses `decimal`. JavaScript only has binary floating point, so `rules.js`
works in integer cents. The non-profit discount (F3) can produce half a cent,
so amounts are held in half-cents and rounded once at the end with
`floor((halfCents + 1) / 2)`, which is half-up. The minimum fee is 2500 cents.

The obvious port is `Math.round(x * 100) / 100` on dollar amounts. It is wrong
for some half-cent totals:

- `150.075 * 100` evaluates to `15007.499999999998`, so `Math.round` gives
  15007. Sports, 0 attendees, registered non-profit, late exception:
  naive result 150.07, C# and `rules.js` give 150.08.
- `75.075 * 100` happens to evaluate to exactly `7507.5`, so the vector cases
  F5-01 (75.075) and F5-02 (125.075) pass even with the naive code.

The last point is the real finding: the first 60 shared vectors all passed
with the naive version, so they did not catch the bug. Vector F5-08 (expected
150.08) was added to `legacy-logic/test-vectors/fees.json` to close that gap.
It passes in C# and in `rules.js`, and `rules.test.js` checks that the naive
version fails on F5-08 and nothing else.

## Limits

- Dates are handled as plain calendar values (UTC), so there is no time zone
  or daylight saving behaviour to differ between environments.
- The report compares outcomes against the shared expected values. It does not
  compare raw C# output, so a rule outside the vectors is not covered.
