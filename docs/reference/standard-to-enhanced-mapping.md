# Standard to enhanced data model: mapping reference

This page is compiled from Microsoft documentation (links below), read on
2026-10-29. It was drafted with AI assistance (Claude Code) and checked
against those pages. It has **not** yet been checked against this lab's own
site. Treat it as a starting point: confirm each row against the lab site
(Power Pages Management app, `pac pages download --modelVersion 2`, and the
`--siteCustomizationReportPath` CSV) before relying on it. Items marked
**[check]** are inferred or not stated directly on a Learn page.

Sources:

- [Enhanced data model](https://learn.microsoft.com/en-us/power-pages/admin/enhanced-data-model) (updated 2026-07-20)
- [Migrate standard data model sites to enhanced data model](https://learn.microsoft.com/en-us/power-pages/admin/migrate-enhanced-data-model) (updated 2026-10-02)
- [Site Component (powerpagecomponent) table reference](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/reference/entities/powerpagecomponent) (updated 2026-09-18)
- [Portals Web API overview](https://learn.microsoft.com/en-us/power-pages/configure/web-api-overview) (updated 2026-10-09)
- [Server logic overview](https://learn.microsoft.com/en-us/power-pages/configure/server-logic-overview) (updated 2026-05-13)

## 1. Where configuration lives

In the standard model each kind of site component has its own `adx_` table.
The enhanced model uses:

- **System tables** (can't be modified): Site (`powerpagesite`), Site
  Component (`powerpagecomponent`), Site Language (`powerpagesitelanguage`).
  A component's properties are stored as JSON in the `content` column of
  `powerpagecomponent`. Web files use the `filecontent` file column.
- **Virtual tables** (`mspp_*`, can't be modified): a table-shaped view over
  the system tables, used by the Power Pages Management app. Because they
  can't be modified, they can't be the target of a new relationship. Learn's
  examples are `mspp_webrole` and `mspp_entitypermission`.
- **Nonconfiguration tables**: transactional data that stays on its own
  table (see 1.2).

### 1.1 Configuration tables

The `powerpagecomponenttype` values are from the choice list on the
powerpagecomponent reference page and the "Site component type reference" in
the migration article. The two lists agree.

| Standard table | Enhanced virtual table | Stored in | `powerpagecomponenttype` |
|---|---|---|---|
| `adx_website` | `mspp_website` | `powerpagesite` | n/a |
| `adx_websitelanguage` | `mspp_websitelanguage` | `powerpagesitelanguage` | n/a **[check]** |
| `adx_publishingstate` | `mspp_publishingstate` | `powerpagecomponent` | 1 Publishing State |
| `adx_webpage` | `mspp_webpage` | `powerpagecomponent` | 2 Web Page |
| `adx_webfile` | `mspp_webfile` | `powerpagecomponent` | 3 Web File |
| `adx_weblinkset` | `mspp_weblinkset` | `powerpagecomponent` | 4 Web Link Set |
| `adx_weblink` | `mspp_weblink` | `powerpagecomponent` | 5 Web Link |
| `adx_pagetemplate` | `mspp_pagetemplate` | `powerpagecomponent` | 6 Page Template |
| `adx_contentsnippet` | `mspp_contentsnippet` | `powerpagecomponent` | 7 Content Snippet |
| `adx_webtemplate` | `mspp_webtemplate` | `powerpagecomponent` | 8 Web Template |
| `adx_sitesetting` | `mspp_sitesetting` | `powerpagecomponent` | 9 Site Setting |
| `adx_webpageaccesscontrolrule` | `mspp_webpageaccesscontrolrule` | `powerpagecomponent` | 10 Web Page Access Control Rule |
| `adx_webrole` | `mspp_webrole` | `powerpagecomponent` | 11 Web Role |
| `adx_websiteaccess` | `mspp_websiteaccess` | `powerpagecomponent` | 12 Website Access |
| `adx_sitemarker` | `mspp_sitemarker` | `powerpagecomponent` | 13 Site Marker |
| `adx_entityform` (basic form) | `mspp_entityform` | `powerpagecomponent` | 15 Basic Form |
| `adx_entityformmetadata` | `mspp_entityformmetadata` | `powerpagecomponent` | 16 Basic Form Metadata |
| `adx_entitylist` (list) | `mspp_entitylist` | `powerpagecomponent` | 17 List |
| `adx_entitypermission` (table permission) | `mspp_entitypermission` | `powerpagecomponent` | 18 Table Permission |
| `adx_webform` (advanced / multistep form) | `mspp_webform` | `powerpagecomponent` | 19 Advanced Form |
| `adx_webformstep` | `mspp_webformstep` | `powerpagecomponent` | 20 Advanced Form Step |
| `adx_webformmetadata` | `mspp_webformmetadata` | `powerpagecomponent` | 21 Advanced Form Metadata |
| `adx_pollplacement` | `mspp_pollplacement` | `powerpagecomponent` | 24 Poll Placement |
| (ad placement) **[check]** | not listed | `powerpagecomponent` | 26 Ad Placement |
| `adx_columnpermissionprofile` | `mspp_columnpermissionprofile` | `powerpagecomponent` | 28 Column Permission Profile |
| `adx_columnpermission` | `mspp_columnpermission` | `powerpagecomponent` | 29 Column Permission |
| `adx_redirect` | `mspp_redirect` | `powerpagecomponent` | 30 Redirect |
| `adx_publishingstatetransitionrule` | `mspp_publishingstatetransitionrule` | `powerpagecomponent` | 31 Publishing State Transition Rule |
| `adx_shortcut` | `mspp_shortcut` | `powerpagecomponent` | 32 Shortcut |

Component types with no `adx_` table listed on Learn: 27 Bot Consumer,
33 Cloud Flow, 34 UX Component, 35 Server Logic (35 appears only on the
powerpagecomponent reference page, not in the migration article's list).

Notes:

- **[check]** `adx_websitelanguage`: the Learn table lists
  `mspp_websitelanguage` / `adx_websitelanguage` both against
  `powerpagesitelanguage` and again in the `powerpagecomponent` row. It has
  no component type number, so `powerpagesitelanguage` is the likely store.
- **[check]** Ad Placement (26) is a component type, but the virtual table
  list on the enhanced data model page has no `mspp_adplacement` row, and
  Ads are removed in the enhanced model (see 1.2).
- Values 14, 22, 23 and 25 are not used.
- **[check]** Role links. In the standard model, roles link to permissions,
  access rules and contacts through N:N tables such as
  `adx_entitypermission_webrole` and `adx_webpageaccesscontrolrule_webrole`
  (both named on the Web API page). The powerpagecomponent reference lists a
  self-referencing N:N `powerpagecomponent_powerpagecomponent`, and the
  N:N `powerpagecomponent_mspp_webrole_contact` (web role to contact),
  `powerpagecomponent_mspp_webrole_account` and
  `powerpagecomponent_webrole_systemuser`. That the component-to-role links
  use the self N:N is an inference.

### 1.2 Tables that are not configuration

From the enhanced data model page:

| Table (display name) | Enhanced model |
|---|---|
| External Identity, Portal comment, Invitation, Invitation Redemption, Setting, WebFormSession | Stay as nonconfiguration tables. Data doesn't take part in ALM. |
| Ad, Poll, Poll Option, Poll Submission | Removed. Not in the Power Pages Management app. |

The migration article names the transactional tables `adx_invitation`,
`adx_inviteredemption`, `adx_portalcomment` and `adx_externalidentity`, plus
"the entity-form / advanced-form submission and log tables". They keep their
schema; the migration rewires their lookups to point at the new
`powerpagecomponent` rows. Example from the powerpagecomponent reference:
`adx_webformsession` has lookups `mspp_webformid` and `mspp_webformstepid`
to `powerpagecomponent`. **[check]** whether code must switch from the old
`adx_` lookup columns to these `mspp_` lookups.

## 2. What `pac pages migrate-datamodel` handles

Handled by the tool (migration article):

- Copies the configuration metadata tables in 1.1 into `powerpagecomponent`
  (mode `configurationData` or `all`).
- Rewires lookups on transactional tables to the new component rows (mode
  `configurationDataReferences` or `all`).
- Switches the active site record to the enhanced model
  (`--updateDatamodelVersion --portalId`). The site then needs a restart.
- Produces a customization report (`--siteCustomizationReportPath`, read
  only) listing direct dependencies on `adx_` tables.
- Can revert (`--revertToStandardDataModel`). The standard and enhanced
  website records are separate, so changes made after the switch don't carry
  back.

Not handled. Microsoft says the tool "doesn't automatically update every
customization that directly depends on standard data model tables", and
that the report does not prove the site works.

| Customization pattern | Migration does | Manual rework | Source |
|---|---|---|---|
| Custom columns on `adx_` metadata tables (e.g. a custom column on `adx_webpage`) | Reported. The column is not carried into `powerpagecomponent`. | Create a custom table with a lookup to `powerpagecomponent`, move the values, update code that reads or writes the column. | Migration article |
| Custom relationships to `adx_` metadata tables | Reported. | Recreate against the enhanced table, usually `powerpagecomponent`. Update dependent forms, views, plug-ins, flows, integrations. The `mspp_` virtual tables can't be relationship targets. | Migration article; enhanced data model page |
| Liquid using `entities['adx_*']` or reading `adx_` attributes | Reported. | Use a supported Liquid object where one exists (Learn's example: `weblinks` instead of querying `adx_weblinkset`). The returned object and attributes can differ, so review each use. | Migration article |
| FetchXML over `adx_` tables (in Liquid `fetchxml`, lists, views) | Reported. | Query the `mspp_` virtual table, or `powerpagecomponent` filtered by `powerpagecomponenttype`. Attribute names change too: Learn's example turns `adx_webpage` / `adx_partialurl` into `powerpagecomponent` with type 2 and `partialurl`. | Migration article |
| Plug-ins and classic workflows registered on `adx_` tables | Reported. | Refactor and re-register on the enhanced table (for metadata, `powerpagecomponent`, filtering on type) using the enhanced schema. Test create, update, delete and security. | Migration article |
| Site JavaScript calling the portals Web API (`/_api/...`) on `adx_` tables | Nothing to migrate for configuration tables: the portals Web API never supported them (Web API page lists `adx_webpage`, `adx_webrole_systemuser`, `adx_webformsession` and others as unsupported). | For transactional tables that do work through the Web API (for example `adx_portalcomment`, which is not on the unsupported list **[check]**), retest any code that reads lookups to configuration records, since those lookups are rewired. | Web API overview; migration article |
| External code calling the Dataverse Web API or SDK on `adx_` tables (integrations, scripts, reports) | Not reported unless it is a plug-in or workflow **[check]**. | Point it at `powerpagecomponent` (or the `mspp_` virtual table) and the new column names. The enhanced data model page says custom code that uses standard data model tables must be updated. | Enhanced data model page |
| Configuration data itself (pages, templates, snippets, settings, forms, lists, roles, permissions) | Migrated. | Validate each area (Learn's Phase 4 table): pages, auth, authorization, forms and lists, custom code, settings and files. | Migration article |

## 3. Where legacy C# business logic goes

Anything the browser runs can be changed or skipped by the user (dev tools,
or calling `/_api` directly), so client code is for feedback only. A rule
that must hold has to run where the user can't change it.

| Target | Runs | Trusted? | Use it for | Not for |
|---|---|---|---|---|
| Client JavaScript (web file, form custom JS) | Browser | No | Instant feedback: format as typed, show or hide fields, a fee preview. | Anything that must hold. Repeat it on the server. |
| Liquid | Server, while the page renders | Only for what it shows. It is not a validation step, since nothing it renders is re-checked on submit. | Display: stored values, role-dependent content (`user`, `has_role`), lists from `fetchxml`. Escape entity data. | Validating or saving input. |
| Server logic | Server, on an `/_api/serverlogics/<name>` call or a `{% serverlogic %}` tag | Yes for its own result: code is not visible to the browser, and access is by web role and table permissions. It only covers writes that go through it. | Calculations and checks the site calls on purpose (fee quote, eligibility, a status change endpoint), calls to external APIs with secrets kept server side. ES2023, no npm packages. Preview **[check]**. | Being the only guard on a column that forms or the Web API can also write. Lock those columns with column permissions, or use a plug-in. |
| Dataverse plug-in (C#) | Dataverse event pipeline, every create or update | Yes, for every channel (site, model-driven app, API, import) | Rules that must hold whatever writes the record: recalculate and store the fee, block a status change that is not allowed. Can reuse a .NET Framework 4.6.2 build of the existing C# library **[check: plug-in assemblies target .NET Framework 4.6.2]**. | Rendering. Knowing the site user's web role without extra lookups. |
| Power Automate cloud flow | Asynchronous (Dataverse trigger) or called from the site (cloud flow integration, or `Server.Connector.CloudFlow` from server logic) | Yes once it runs, but an automated trigger runs after the save | Notifications, approvals, follow-up updates, integration. | Blocking a save in real time. |

For this lab's rules (see `conversion/README.md` for the per-rule table):
fees and eligibility are computed in server logic and stored; the client
copy in `conversion/js/rules.js` gives the preview; status changes go
through server logic, and a plug-in is the backstop if any other channel can
write the status.
