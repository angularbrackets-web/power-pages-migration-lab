# Adxstudio to Power Pages Migration Lab

**Status: in progress (started October 2026)**

This is a hands-on lab. I'm working through the full path from a legacy Adxstudio-style portal to a modern Microsoft Power Pages site on the Dataverse Enhanced Data Model. I build each step myself and write down what breaks and how I fixed it.

My background is in .NET / C# and in modernizing legacy ASP.NET systems. This repo is where I apply that background to the Power Pages platform.

## What the lab covers

1. **Discovery.** Inventory a standard-data-model portal: its `adx_` configuration tables, web pages, web templates, entity forms, web forms, lists, web roles and site settings. Write a short migration assessment.
2. **Data model migration.** Move the site from the standard data model to the Enhanced Data Model with the Power Platform CLI (`pac pages`). Record the before/after table mapping and any errors.
3. **Business logic conversion.** Take sample legacy C# business rules (validation, eligibility checks, calculated fields) and convert them to Liquid web templates and client-side JavaScript. Use GitHub Copilot / Copilot to speed up the conversion, and check every converted rule against test cases.
4. **Forms and lists.** Rebuild a multi-page entity/web form as a Power Pages multistep form, and a legacy list as a modern list with filtering.
5. **Security.** Map legacy security roles to Dataverse table permissions and web roles. Test each role with a matching test user.
6. **Front end.** Refactor legacy CSS and JavaScript to current standards (Bootstrap 5 based theme).
7. **ALM.** Download and upload the site with `pac pages`, keep it in source control, and document the deployment steps.

## Progress

- [x] Repo and scope
- [ ] Developer environment (Power Apps Developer Plan) and sample site
- [ ] Discovery notes and migration assessment
- [ ] Enhanced Data Model migration
- [ ] C# rules to Liquid / JavaScript (with test cases)
- [ ] Multistep form and list rebuild
- [ ] Table permissions and web roles mapping
- [ ] CSS / JS refactor
- [ ] Deployment notes and lessons learned

## Repo layout (planned)

```
docs/          discovery notes, mapping tables, lessons learned
legacy-logic/  sample C# business rules and their test cases
site/          Power Pages site files downloaded with pac pages
scripts/       pac CLI scripts
```

## Notes

- This is a personal learning project. It contains no client or employer code or data.
- Sample data is fictional.
