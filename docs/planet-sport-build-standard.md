# Planet Sport Build Standard

**Version:** 1.1  
**Owner:** Planet Sport  
**Purpose:** A shared standard for building AI-led websites, apps, data products and internal tools.

---

## 1. Our Goal

Use AI to help Planet Sport grow by creating better products, stronger user relationships and new revenue.

AI can write the code, but Planet Sport remains in control of:

- The problem we are solving.
- The user and business value.
- Product and data decisions.
- Quality, safety and legal approval.
- What reaches real users.

The goal is not to produce more code. The goal is to produce useful, trusted products that can be supported by the wider team.

---

## 2. Build on What Already Works

Before creating anything new, every project must check whether it can reuse an existing Planet Sport capability.

| Existing capability | Reuse it for |
| --- | --- |
| User accounts | Sign-in, profiles, preferences and permissions |
| Audience and user data | Personalisation, segments, retention and insight |
| Analytics and business insights | Product measures, reporting and decisions |
| Sports data | Teams, players, fixtures, results, tables and rankings |
| Publishing platforms | Content, authors, brands, pages and distribution |
| Existing brand audiences | Launch, testing, feedback and growth |
| Commercial systems | Advertising, betting, subscriptions, sponsorship and leads |

### Core rule

**Reuse before rebuild. Connect before copy. Extend before replace.**

A new product must not create another version of a user, team, player, fixture, competition or article when a trusted Planet Sport record already exists.

Shared records must use stable IDs. Each ID should point to one clear entity and work across products, seasons and data suppliers.

---

## 3. Start With the Business Case

No build starts with a feature list. It starts with a short product brief.

Every brief must answer:

1. Who is this for?
2. What problem does it solve?
3. Why is Planet Sport well placed to solve it?
4. Which existing systems and data can we reuse?
5. How does it improve the user experience?
6. How could it grow audience, data, engagement or revenue?
7. What does success look like after 30, 90 and 365 days?
8. What rights, legal, data or brand limits apply?
9. What is the smallest useful version we can test?
10. Who will own it after the prototype?

If these answers are unclear, AI must question the idea before writing code.

---

## 4. The Planet Sport Build Flow

### Gate 1 — Understand

Create and agree:

- Product brief.
- Target users and main user journeys.
- Commercial case.
- Measures of success.
- Existing systems and data to reuse.
- Known limits, risks and assumptions.

**Exit test:** We can explain the product, user value and commercial value in plain English.

### Gate 2 — Design

Create and agree:

- Simple product design or prototype.
- Technical approach.
- Data model and stable ID plan.
- Source-of-truth list for every key data type.
- Privacy, rights and security approach.
- Web SEO and app discovery plan.
- Delivery stages and ownership.

**Exit test:** A developer can understand what is being built, how it connects and why the main choices were made.

### Gate 3 — Build

AI may write the code in small, testable tasks. Each task must have:

- A clear goal.
- Acceptance checks.
- Named files or systems in scope.
- Tests to add or update.
- Clear exclusions.
- A record of any new assumption or design choice.

**Exit test:** The feature works locally and all automated checks pass.

### Gate 4 — Prove

The project must be checked through:

- Automated tests.
- Real browser or device testing.
- Independent code review using fresh AI context.
- Security and dependency checks.
- Data-source and calculation checks.
- SEO and performance checks.
- Accessibility checks.
- Key user journeys and failure cases.

**Exit test:** There is evidence for every claim that the feature works.

### Gate 5 — Release

Before real users see it:

- A named person approves the release.
- Monitoring and alerts are working.
- Rollback steps are documented and tested where practical.
- Analytics events and dashboards are checked.
- Support and ownership are agreed.
- Major or high-risk releases receive human developer review.

**Exit test:** We can detect a problem, understand its effect and safely respond.

### Gate 6 — Learn and Improve

After release:

- Compare results with the agreed success measures.
- Review user feedback, search data and product use.
- Review errors, security alerts and data quality.
- Record what worked, what failed and what should change.
- Add useful improvements to a ranked work queue.

**Exit test:** Evidence, not opinion, decides the next step.

---

## 5. Rules for AI-Written Code

AI is the main coding engine, but it must work within these rules:

1. Read the current project, documentation and tests before changing code.
2. Do not invent APIs, data, files, results or completed tests.
3. Mark assumptions and ask when a choice affects users, money, rights, security or the main design.
4. Prefer the current project structure and tools unless there is a clear case to change them.
5. Make small changes that can be reviewed and reversed.
6. Do not rewrite working areas without clear need and approval.
7. Add or update tests with every material change.
8. Do not weaken security, tests or type checks to make a build pass.
9. Never place passwords, tokens or private data in code, prompts, logs or Git.
10. Show proof: commands run, tests passed, pages checked and known issues.
11. Separate facts, assumptions and recommendations.
12. Stop and report a blocker rather than hiding it or guessing.

AI output is a proposal until checks prove it works.

---

## 6. Code Quality Standard

Code should be:

- Easy for a developer and AI agent to understand.
- Split into clear parts with one main purpose.
- Consistent with the current framework and project style.
- Typed where the stack supports it.
- Free from needless duplication.
- Documented where the reason is not clear from the code.
- Covered by tests based on risk.
- Built from supported, well-maintained packages where practical.
- Free from dead code, fake data and unfinished placeholders at release.

The team should reject clever code that is hard to support when a simpler option works.

### Leave the project healthy

Cursor, Codex or any other AI agent must not leave the project in a worse or broken state.

Before changing code, the agent must:

- Check the current Git status and preserve unrelated user work.
- Run or record the relevant baseline checks so existing failures are separated from new ones.
- Understand the current start, build and test commands.
- Identify the user journeys and shared systems the change could affect.

After changing code, the agent must:

- Run the relevant type, lint, test and production-build checks.
- Test the changed journey and the main connected journeys.
- Check browser, server and application logs for new errors.
- Check that development and production-style start-up still work.
- Confirm whether a restart, cache clear, rebuild or hard refresh is genuinely required.
- Explain the reason when one of those actions is required; do not use a hard refresh to hide a fault.
- Remove temporary files, debug code, fake data and unfinished work.
- Update documentation when setup or behaviour changed.

If the agent cannot complete or verify a change, it must stop in a safe state. It should fix or cleanly revert only its own incomplete changes where that can be done without touching user work. If safe recovery is unclear, it must preserve the files, report the exact issue and ask for direction.

The agent must never claim a project is healthy based only on the page loading once.

### Design fidelity and reference images

When a design, screenshot, mock-up or existing page is supplied, it is a delivery reference rather than loose inspiration.

Before coding, the agent must create a short design breakdown covering:

- Page structure and component hierarchy.
- Desktop and mobile layout.
- Spacing, alignment, sizing and responsive behaviour.
- Typography, colours, borders, shadows and states.
- Navigation and interaction behaviour.
- Real content and data needed for each area.
- Existing components and assets that can be reused.
- Elements that can be reproduced accurately with HTML, CSS and project-native code.
- Images, illustrations, icons, charts or other assets that must be supplied, found, generated or created separately.
- Unknowns that require a product or design decision.

The agent must not invent unsupported sections, copy, numbers, controls, images or behaviour simply to fill space.

### Asset rules

- Use existing brand assets and component libraries first.
- Do not replace a supplied image or logo with an unrelated placeholder.
- Do not attempt to reproduce a photograph or detailed illustration using unsuitable CSS shapes.
- Do not create text inside an image when it should be real accessible HTML.
- Record the source, rights and intended use of external assets.
- If an asset is missing, state exactly what is needed and use an agreed labelled placeholder only when approved.

### Design proof

Before handover, the agent must:

- Render the implemented page at the agreed desktop and mobile sizes.
- Compare it visually with the supplied reference.
- Check for overlap, clipping, broken text, wrong spacing, poor contrast and missing assets.
- Test interactive and responsive states, not only the first screen.
- List any deliberate differences and obtain approval for material changes.

“Similar”, “inspired by” or “the page loads” is not enough when faithful replication was requested.

---

## 7. Testing and Proof

The level of testing should match the risk, but every product needs a minimum set.

### Required checks

- Install completes from a clean setup.
- Type check passes where used.
- Lint and formatting checks pass.
- Production build passes.
- Unit tests cover important rules and calculations.
- Integration tests cover databases, APIs and shared systems.
- End-to-end tests cover the main user journeys.
- Error, empty, slow and missing-data states work properly.
- Key pages are checked on mobile and desktop.
- Key app journeys are checked on supported devices.
- No serious browser or server errors remain.

A test result must come from the actual current code. AI must never claim a check passed if it did not run it.

### Importers and long-running jobs

Data imports, migrations and other long-running jobs must be designed to fail safely and resume cleanly.

They must include, where relevant:

- One shared storage contract for file names, formats, compression and paths.
- Round-trip tests that write data and then read the exact stored output.
- Stop-and-resume tests using real stored formats rather than only mock data.
- Checkpoints after each safe unit of work.
- Restart without repeating completed work or creating duplicates.
- Durable execution that does not depend on Cursor, Codex or a terminal staying open.
- Logs and status that survive the launching shell.
- Timeouts, retries and backoff for temporary API failures.
- Safe handling of rate-limit responses such as HTTP `429`.
- Rate limits held in configuration and checked against current supplier terms.
- Validation of empty, partial, corrupt and unexpected responses.
- A final completeness report showing expected, imported, skipped and failed records.

An importer is not complete because it downloaded one record or completed once. It must survive interruption, resume safely and prove that the final dataset is complete.

---

## 8. Security and Privacy

Security is part of the build, not a final check.

Every product must consider:

- Authentication: who is the user?
- Authorisation: what are they allowed to see or change?
- Data protection: what personal or sensitive data is stored?
- Input checks: can unsafe or false data enter the system?
- API protection: are access, limits and errors handled safely?
- Secrets: are keys stored outside code and logs?
- Dependencies: are packages trusted, supported and scanned?
- Logging: can we investigate problems without exposing private data?
- Backups and recovery: can important data be restored?
- Abuse: can bots, scraping, spam or fraud damage the product?

### Release blockers

Do not release with:

- Known critical or high-risk security issues.
- Exposed secrets.
- Broken access controls.
- Unclear ownership of personal data.
- Unchecked changes to payments, betting, accounts or admin permissions.

High-risk areas require a human security or senior developer review.

---

## 9. Data and Sports Intelligence

Every important data item must have:

- A clear source of truth.
- A stable Planet Sport ID.
- Its source and time of collection.
- A quality or confidence status where needed.
- Rules for updates, clashes and missing values.
- A named owner.

AI must not present generated or inferred data as a known fact.

### Calculated rankings, ratings and insights

For any Planet Sport score or insight, record:

- Inputs used.
- Formula or model version.
- Weightings.
- Missing-data rules.
- Date calculated.
- Explanation suitable for users and editors.

Changing a formula must create a new version so past results can be explained.

---

## 10. Web SEO Standard

SEO is part of product design, not work added after launch.

Every public web product must consider:

- Search demand and user intent.
- Crawlable links and server-rendered content where needed.
- Clear URLs and canonical rules.
- Unique titles, headings and descriptions.
- Useful page copy, not empty data templates.
- Internal links between articles, entities and competitions.
- Structured data based on visible, correct content.
- XML sitemaps, robots rules and index controls.
- Page speed and Core Web Vitals.
- Mobile usability and accessibility.
- Image size, names, alt text, captions and credits.
- Author, source, updated date and editorial trust signals.
- Control of thin, duplicate, filtered and expired pages.
- Search Console and analytics measurement.

Important SEO content must be checked in the HTML delivered to search engines, not only on the screen after JavaScript runs.

---

## 11. App Discovery and Quality

Every app product must consider:

- App name, description, keywords, icon, screenshots and preview material.
- Clear store value and reasons to install.
- Deep links from web pages into the right app screen.
- App indexing and web-to-app journeys where supported.
- Fast start-up, stable screens and sensible offline states.
- Sign-in and account links that work across web and app.
- Push notifications based on clear user choices.
- Ratings, reviews, crash data and store performance.
- Retention, active users and uninstall signals.
- Apple and Google store rules, privacy labels and permissions.

The app and website should strengthen each other rather than operate as separate products.

---

## 12. Measurement and Commercial Value

Every project must define one main user measure and one main business measure.

Possible measures include:

- New and returning users.
- Registered or known users.
- Active app users.
- Retention and visit frequency.
- Newsletter, notification or alert sign-ups.
- Pages or useful actions per visit.
- Search visibility and organic visits.
- Ad, affiliate, betting, subscription or lead revenue.
- Data collected with user consent.
- Reduced cost or staff time.

Do not use page views alone to judge whether a product is good.

Analytics must be designed before release, checked after release and linked to a dashboard the product owner can understand.

---

## 13. Rights, Legal and Editorial Trust

Every project must identify:

- Rights held, licensed or unavailable.
- Data and content supplier terms.
- Image, video, audio and logo permissions.
- Gambling, advertising and age-related rules.
- Privacy, cookies and consent needs.
- Editorial ownership and correction process.

Ideas in a legal or rights grey area must be recorded and reviewed. AI cannot approve a legal risk.

---

## 14. Documentation and Team Handover

A prototype is not ready for handover until it includes:

- Product brief and success measures.
- Current feature list and known gaps.
- Technical and data overview.
- Stable ID and source-of-truth rules.
- Setup and deployment guide.
- Environment variable list without secret values.
- Test plan and latest results.
- Security, privacy, rights and SEO notes.
- Analytics event list and dashboard links.
- Key decisions and reasons.
- Known risks and technical debt.
- Work queue with clear priorities.
- Named product, technical and data owners.
- Original design references and their status.
- A design-to-build map showing how each visible element was implemented.
- Desktop and mobile comparison images for key screens.
- Missing assets, approved differences and unresolved design decisions.

A new developer should be able to run the project and understand its purpose without relying on the original AI conversation.

---

## 15. Definition of Done

A feature is only **Done** when:

- It meets the agreed user and business need.
- It reuses existing Planet Sport systems where suitable.
- Acceptance checks have passed.
- The production build and required tests pass.
- The main user journey has been checked in a real browser or app.
- Security, privacy, rights and data risks have been reviewed.
- Web SEO or app discovery needs are met.
- Analytics and monitoring work.
- Documentation is updated.
- Known limits are recorded.
- The product owner accepts the result.
- The wider project is no less healthy than it was before the change.
- No new unexplained errors, warnings or broken journeys remain.

**Built is not Done. Working once is not Done. AI saying it works is not Done.**

---

## 16. Roles

| Role | Main responsibility |
| --- | --- |
| Business/Product Lead | Sets the vision, user need, commercial goal and priority |
| AI Agent | Researches, challenges, designs, codes, tests and documents within the rules |
| Technical Owner | Approves architecture, security and readiness for support |
| Data Owner | Approves sources, IDs, quality rules and access |
| Editorial/SEO Owner | Approves search, content quality, trust and publishing rules |
| Commercial Owner | Tests the revenue case and partner needs |
| Product Owner | Accepts the release and measures results |

One person may hold more than one role, but the responsibility must still be clear.

---

## 17. Project Kick-off Template

Copy this into every new project:

```md
# Project

## The opportunity
What are we building and why now?

## Target users
Who is it for and what do they need?

## Planet Sport advantage
Which brands, audience, data, accounts, insight or commercial links give us an edge?

## Existing systems to reuse
What must we connect to rather than rebuild?

## User value
What becomes easier, faster or better?

## Commercial value
How could this grow audience, known users, engagement, revenue or reduce cost?

## First useful version
What is the smallest version worth testing?

## Data and sources
What data is needed, who owns it and what IDs link it?

## SEO and app discovery
How will people find and return to it?

## Risks and limits
What could fail across code, data, security, rights, privacy or support?

## Success measures
What will we measure after 30, 90 and 365 days?

## Owners
Who owns product, technology, data, SEO/editorial and commercial results?
```

---

## 18. How We Improve This Standard

This is a living standard.

When a project finds a bug, security issue, poor AI behaviour or better way of working:

1. Fix the immediate issue.
2. Find why the process allowed it.
3. Add or improve a test, rule, check or template.
4. Apply that learning to other projects where relevant.
5. Record the change in the next version of this standard.

The aim is not only to fix one problem. It is to make the next project safer and better.
