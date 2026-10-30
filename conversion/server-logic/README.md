# server-logic

The trusted rules (eligibility E1-E3, fees F1-F5, status S1) as Power Pages
server logic: JavaScript that runs on the Power Pages server, behind
`/_api/serverlogics/<name>`.

This folder was drafted with AI assistance (Claude Code). The platform facts
below were checked against the Microsoft Learn pages linked next to them, and
the code is checked by the tests in this folder. Nothing here has run on a
live Power Pages site yet.

## Files

| Path | What it is |
|------|-----------|
| `nb-permit-rules/nb-permit-rules.js` | The server logic file. **Generated, do not edit.** |
| `nb-permit-rules/nb-permit-rules.serverlogic.yml` | Metadata for the record (name, id, web roles). See "File layout" for how sure this is. |
| `src/handlers.js` | The hand-written part: `get()`, `post()`, request parsing, Dataverse calls. |
| `build.js` | Builds the server logic file. `--check` fails if it is stale. |
| `server-logic.test.js` | `node --test` suite. Runs the generated file against the shared vectors with a stubbed `Server` object. |

## One copy of the rules

The rule bodies are not rewritten for the server. `conversion/js/rules.js`
marks the plain-JavaScript part of the port with `// <shared>` and
`// </shared>`. `build.js` copies those regions, minus one level of
indentation, and appends `src/handlers.js`. The tests check that:

- the committed file is exactly what `build.js` produces now, so an edit to
  `rules.js` without a rebuild fails the tests;
- every shared region appears unchanged in the server logic file;
- the file has no `require`, `module.exports`, or any of the restricted
  patterns listed by Microsoft (see Limits);
- each E, F and S vector gives the expected value through `post()`, and the
  same value as `rules.runVector`.

The V rules (V1-V4) are in the shared regions too. The server logic file
contains them but does not expose them yet.

```
node conversion/server-logic/build.js        # after changing rules.js or handlers.js
node --test conversion/server-logic/server-logic.test.js
```

`conversion/parity/run-parity.sh` runs the `--check` and this suite as well.

## Platform facts (Microsoft Learn, read 2026-10-29)

| Fact | Source |
|------|--------|
| Runtime is JavaScript compliant with ECMAScript 2023, without browser APIs (no DOM, `fetch`, `XMLHttpRequest`). Some patterns are blocked. | [Server logic overview](https://learn.microsoft.com/en-us/power-pages/configure/server-logic-overview) (2026-05-13) |
| URL is `https://<site-url>/_api/serverlogics/<server-logic-name>`. HTTP verbs map to functions `get()`, `post()`, `put()`, `patch()`, `del()`. | Overview |
| Access is governed by web roles assigned to the server logic record, and table permissions decide which tables it can reach. Authentication is the site session. Every HTTP call needs a CSRF token (`shell.safeAjax` adds it). | Overview; [Author server logic](https://learn.microsoft.com/en-us/power-pages/configure/author-server-logic) (2026-08-03) |
| The HTTP response wraps the returned string: `{ RequestId, Success, Data, ExecutionTime, ServerLogicName, Error }`. | Author server logic |
| Liquid can call it during rendering: `{% serverlogic name: '...', operation: '<function>', input: ..., output: result %}`. No CSRF token needed there. Input arrives in `Server.Context.Input`. | Author server logic |
| Site settings: `ServerLogic/Enabled` (default true), `ServerLogic/AllowedDomains`, `ServerLogic/TimeoutInSeconds` (default 120, max 240), `ServerLogic/AllowNetworkingToAllDomains`. Tenant admins can block outbound HTTP calls per site. | Overview |
| Request data: `Server.Context.QueryParameters`, `.Body` (raw string), `.HttpMethod`, `.Headers`, `.Url`, `.FunctionName`, `.ActivityId`, `.Input` (Liquid only). | [Server objects](https://learn.microsoft.com/en-us/power-pages/configure/server-objects) (2026-09-15) |
| Signed-in user: `Server.User`, null when anonymous. The only documented property is `fullname`. | Server objects |
| Dataverse: `Server.Connector.Dataverse.CreateRecord / RetrieveRecord / RetrieveMultipleRecords / UpdateRecord / DeleteRecord / InvokeCustomApi`. Arguments are strings and use the EntitySetName (`accounts`, not `account`). | Server objects |
| Other objects: `Server.Logger` (Log, Warn, Error; shown in the DevTools extension), `Server.Connector.HttpClient` (async), `Server.Connector.CloudFlow.TriggerAsync`, `Server.SiteSetting.Get`, `Server.EnvironmentVariable.get`, `Server.Website`. | Server objects |
| A server logic record is stored as a Site Component (`powerpagecomponent`) row with `powerpagecomponenttype` = 35 (Server Logic). | [powerpagecomponent table reference](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/reference/entities/powerpagecomponent) (2026-09-18) |

### Limits

From [Author server logic, Limitations](https://learn.microsoft.com/en-us/power-pages/configure/author-server-logic#limitations):
no browser APIs, and the script is rejected if it contains any of
`__dirname`, `__filename`, `import(`, `import from`, `eval(`, `Function(`,
`setTimeout(`, `setInterval(`, `setImmediate(`, `process.exit`,
`process.kill`, `child_process`, `fs.`, `require(`,
`constructor.constructor`, `this.constructor`, `arguments.callee`, `with(`,
`delete`, `Object.getPrototypeOf`, `Object.setPrototypeOf`, `Proxy(`,
`Reflect.`, `Symbol.for`, `__proto__`, `prototype`, `debugger`. The check
appears to be on the text, so comments count. This is why `rules.js` keeps
its Node and browser wrapper outside the shared regions.

## How this file is meant to be used

| Call | Purpose |
|------|---------|
| `GET /_api/serverlogics/nb-permit-rules?category=Sports&expectedAttendance=0&isRegisteredNonProfit=true&isLateException=false` | Fee quote (F1-F5). |
| `POST` `{ "operation": "eligibility", "input": { dateOfBirth, eventDate, registryNumber, applicantType, expectedAttendance } }` | E1-E3. A check whose inputs are missing returns null. |
| `POST` `{ "operation": "fee", "input": { category, expectedAttendance, isRegisteredNonProfit, isLateException } }` | `baseFee`, `surcharge`, `fee`. |
| `POST` `{ "operation": "transition", "input": { from, to } }` | S1. The role is looked up on the server from the signed-in contact's web roles. A `role` in the body is ignored. |
| `POST` `{ "operation": "recalculateFee", "input": { applicationId } }` | Reads the application from Dataverse, calculates the fee and writes it back. Only the id comes from the client. |

All functions return `JSON.stringify(...)`. Rule errors come back as
`{ "error": "invalid_category" }` and similar, the same shape as the vectors.
The Dataverse names in `NB_CONFIG` (`nb_permitapplications`,
`nb_eventcategory`, `nb_feeamount`, ...) and the web role names are
assumptions until the lab table and roles exist.

## What the tests prove, and what they don't

Verified locally:

- The server logic file runs the same rule code as `rules.js` and gives the
  expected answer for all E, F and S vectors when called through `post()`.
- It is plain script: no modules, no restricted patterns from the Learn list,
  and every handler returns a string.
- The handlers ignore a client-supplied role (S1) and client-supplied fee
  inputs (`recalculateFee`), and a malformed body returns a JSON error.

Not verified without a live site:

- **The `Server` object is a stub.** It is built from the Learn descriptions,
  marked `STUB` in the test, and it is not the platform. Return shapes of the
  Dataverse connector (string envelope with a JSON `Body`) follow the Learn
  CRUD sample and may differ.
- **`Server.User.contactid` is an assumption.** Learn documents only
  `fullname`.
- **Reading the caller's web roles.** The code expands
  `powerpagecomponent_mspp_webrole_contact` on the contact. The relationship
  name is from the Dataverse reference, but whether server logic can read it
  under the site's table permissions is untested. If it can't, the fallback
  is one server logic record per role (Learn documents role assignment on
  the record), or a Dataverse plug-in.
- **HTTP status codes.** Learn does not say how server logic sets a status
  code, so errors are returned as data inside a successful response. The
  caller must check the `error` field.
- **Whether the validator accepts this exact file**, including the `in`
  operator, regex literals and `Date.UTC`. These are ordinary ES2023 and not
  on the blocked list, but only an upload will show it.
- **File layout and the `.yml` keys.** Learn does not document the folder
  layout of a downloaded site for server logic. The layout used here
  (`server-logic/<name>/<name>.js` and `<name>.serverlogic.yml` with keys
  `adx_serverlogic_adx_webrole`, `description`, `display_name`, `id`, `name`)
  comes from Microsoft's `power-platform-skills` repository on GitHub
  (`plugins/power-pages/skills/add-server-logic`), which targets code sites.
  Compare with a site downloaded by `pac pages download` before uploading.
- **Release status and data model.** A Microsoft Power Platform blog post,
  "Power Pages Server Logic (preview): Enhancements", says server logic is
  still in preview and is supported on standard data model sites. The how-to
  page [server-logic-operations](https://learn.microsoft.com/en-us/power-pages/configure/server-logic-operations)
  still shows the menu as "Server logic (preview)". Check the studio.
- **Function names other than the five verbs.** Learn's Liquid example calls
  a custom function (`getSummary`). The GitHub skill says only the five verb
  functions are allowed. This file exposes only `get()` and `post()`.

## What server logic does not do for these rules

- **It does not stop a direct write.** Server logic is a separate endpoint.
  If the site's Web API or a form lets a user write `nb_feeamount` or the
  status column, they can skip it. The fee and status columns need column
  permissions (or a form without those fields) so that only the server logic
  or a plug-in writes them. A Dataverse plug-in on the table is the only
  option here that runs on every write, whatever the channel.
- **It does not run automatically on save.** The form or a flow has to call
  it. A plug-in or a Power Automate trigger fires on the record change.
- **No documented transaction.** Reading, calculating and updating are
  separate connector calls.
