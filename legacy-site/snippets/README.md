# legacy-site/snippets

Small pieces of code for seeding the lab's standard-data-model site before it
is migrated to the enhanced data model. Each one is written on purpose in the
older Adxstudio / standard-model style, so the migration's customization
report has something real to find and there is something to fix afterwards.
They are not examples of good current practice.

The snippets were drafted with AI assistance (Claude Code). They have not been
run against a site yet. What actually happens to them during the migration
will be written up separately once it has been done.

## Files

| File | Pasted into | What it exercises |
|------|-------------|-------------------|
| `legacy-page-details.liquid` | Web template "Northbank Legacy Page Details", used by a page template | Reads the current page with `entities['adx_webpage'][page.id]` and shows a custom column (`nb_legacynote`) added to `adx_webpage` |
| `legacy-page-list.liquid` | Web template "Northbank Legacy Page List" (included by the one above) | A Liquid `{% fetchxml %}` query over `adx_webpage`, filtered by `adx_websiteid` |
| `attendance-warning.js` | Custom JavaScript on step 1 of the permit multistep form | jQuery, ES5, inline styles set from script, Bootstrap 3 era colours. Input for the CSS/JS refactor |

## Assumptions

- Custom tables and columns use the publisher prefix `nb`. With a different
  prefix, change `nb_legacynote` and `nb_expectedattendance` to match.
- `nb_legacynote` is a single line of text column added to the Web Page
  (`adx_webpage`) table.
- `nb_expectedattendance` is a whole number column on the permit application
  table, and it is on the form used by step 1. Power Pages gives each form
  input an HTML id equal to the column's logical name, which is what the
  script relies on.
- Create "Northbank Legacy Page List" before "Northbank Legacy Page Details",
  because the second one includes the first by name.

## Why these patterns matter for the migration

Microsoft's migration guidance lists these as customizations that the
migration utility does not update automatically:

- custom columns on `adx_` metadata tables such as `adx_webpage`
- Liquid that reads `adx_` tables through `entities`
- FetchXML that queries `adx_` tables

In the enhanced data model, web pages are stored in `powerpagecomponent`
(component type 2), so each of these needs a rewrite. Source:
[Migrate standard data model sites to enhanced data model](https://learn.microsoft.com/en-us/power-pages/admin/migrate-enhanced-data-model).

The JavaScript is not affected by the data model. It is here so the front-end
refactor has a realistic starting point.
