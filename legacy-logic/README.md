# legacy-logic

`Northbank.Permits.Rules` is a small C# class library holding the business
rules of the fictional Town of Northbank Community Event Permit Portal. In this
lab it is the "legacy source of truth": the rules are converted to other
targets (JavaScript, server logic, Liquid) and each conversion is checked
against the same test vectors.

The library targets netstandard2.0 and is written in a plain, older style:
static classes, enums, XML doc comments. Tests use xUnit on net10.0.

## Rules

| ID | Rule | Class |
|----|------|-------|
| E1 | Applicant is 18+ on the event date | `EligibilityRules` |
| E2 | Organization registry number matches `NB-` + 6 digits | `EligibilityRules` |
| E3 | Over 500 attendees requires an organization applicant | `EligibilityRules` |
| V1 | Submit 21 days before the event (45 if over 250 attendees) | `ValidationRules` |
| V2 | Event end after start, at most 3 calendar days | `ValidationRules` |
| V3 | Alcohol served requires a liquor licence number | `ValidationRules` |
| V4 | Phone as `(xxx) xxx-xxxx`, postal code as `A1A 1A1` | `ValidationRules` |
| F1 | Base fee by category (Community, Commercial, Sports) | `FeeCalculator` |
| F2 | Attendance tier surcharge (0-100, 101-250, 251-500, 501+) | `FeeCalculator` |
| F3 | Registered non-profit pays 50% of the base fee, not of surcharges | `FeeCalculator` |
| F4 | Late application approved by exception adds 75.00 | `FeeCalculator` |
| F5 | Round half-up to cents, minimum fee 25.00 | `FeeCalculator` |
| S1 | Status transitions and which role may make them | `StatusRules` |

F5 is deliberate: fees use `decimal`, and half-cent cases (for example
75.075) are a known place where JavaScript `number` gives different results.

## Test vectors

`test-vectors/*.json` hold 60 shared cases, one file per rule group. Each case
is `{ id, rule, input, expected, note }`. The xUnit tests load these files, so
another implementation can run the exact same files. Dates are ISO strings;
errors are expected as `{ "error": "invalid_category" }` or
`{ "error": "invalid_attendance" }`.

## Run the tests

Requires the .NET 10 SDK.

```
cd legacy-logic
dotnet test
```
