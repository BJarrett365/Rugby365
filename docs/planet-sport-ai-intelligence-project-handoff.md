# Planet Sport AI Intelligence Project

## Project Summary and AI Handoff

**Document purpose:** This file gives Cursor, Codex and the Planet Sport team the shared context, goals, rules and starting instructions for the project.

**Related standard:** `Planet-Sport-Build-Standard.md`

---

## 1. The Vision

Planet Sport is not trying to replace its websites, apps, people or current systems.

We want to use AI to improve what already works and help Planet Sport:

- Build better products for sports fans.
- Turn anonymous audiences into known, returning users.
- Improve websites, apps, social engagement and newsletters.
- Make stronger product and commercial decisions.
- Create original sports data, rankings and insights.
- Find growth opportunities faster.
- Help the existing team work more effectively.
- Build prototypes that can be safely handed to development teams.

The aim is not more code or more dashboards. The aim is measurable audience, product and commercial growth.

---

## 2. What We Are Building

We are building a connected **Planet Sport Intelligence Platform** with three main projects.

### A. Planet Sport Intelligence

The central **audit and decision engine**.

It should:

- Audit Planet Sport websites, apps and digital products.
- Bring together search, traffic, user, social, app and commercial data.
- Find SEO, content, product, data, speed, UX and revenue gaps.
- Compare Planet Sport products with competitors.
- Rank opportunities by value, effort, evidence and risk.
- Turn approved recommendations into clear project tasks.
- Track what was built and measure the result.
- Learn from each release and improve future recommendations.

Planet Sport Intelligence must connect to Rugby365 and F1 Intelligence. It should not be a separate dashboard that only reports numbers.

### B. Rugby365

The first full **sports data, rankings and authority product**.

It should bring together:

- Fixtures, results and live match information.
- Players, teams, coaches, referees, venues and competitions.
- Current and historical statistics.
- Original Planet Rugby/Rugby365 ratings and rankings.
- Player, team and coach comparisons.
- Form, trends and explainable insights.
- Clear methods and source information.
- Editorial content linked to structured sports data.

The goal is to make Planet Rugby a destination that deserves citations from publishers, search engines, AI systems and, where suitable, Wikipedia editors.

### C. F1 Intelligence

The first full **live, historical and personalised fan product**.

It should bring together:

- Current and previous calendars.
- Races, sessions, results and standings.
- Drivers, teams, circuits and seasons.
- Live and historical performance data.
- Driver and team comparisons.
- Original ratings, trends and explainers.
- Personal follow lists, alerts and race experiences.
- New data-led products that go beyond a standard results service.

---

## 3. How the Projects Connect

Planet Sport Intelligence should receive data and evidence from Rugby365 and F1 Intelligence, then return ranked recommendations and approved work.

### Planet Sport Intelligence receives

- Search Console and SEO data.
- Analytics and user behaviour.
- Social engagement.
- App installs, use, retention and crashes.
- Revenue and commercial performance.
- Product use and conversion.
- Technical health, speed and errors.
- Data coverage and data quality.
- Work completed, tests and release results.

### Planet Sport Intelligence returns

- Evidence-backed opportunities.
- Priority scores.
- Product briefs.
- Clear acceptance criteria.
- Suggested tests and measures.
- Approved tasks for the Rugby365 or F1 work queue.
- Results and learning after release.

### Control rule

Planet Sport Intelligence may audit, recommend, track and measure. It must not change a live product without approval.

Start with read-only connections. Safe automation can be added later after it has been tested and approved.

---

## 4. Build on Existing Planet Sport Assets

Before creating anything new, check whether the project can reuse:

- User accounts and sign-in.
- User interests and preferences.
- Audience and behavioural data.
- Existing analytics and business insights.
- Sports data and existing entity records.
- Publishing systems, content, brands and authors.
- Existing websites, apps and distribution partners.
- Advertising, betting, affiliate, subscription or lead systems.
- Social audiences, newsletters and notifications.

**Core rule: Reuse before rebuild. Connect before copy. Extend before replace.**

Do not create duplicate records or new data silos when a trusted Planet Sport source already exists.

---

## 5. Shared Data Foundation

All connected sports products should use stable Planet Sport IDs for:

- Sports.
- Countries.
- Competitions.
- Seasons and calendars.
- Fixtures, matches, races and sessions.
- Teams and constructors.
- Players and drivers.
- Coaches, referees and officials.
- Venues and circuits.
- Articles, authors and brands where linked.
- Users and user preferences.

Each important record must include:

- Stable internal ID.
- Source ID or IDs.
- Source name.
- Collection or update time.
- Quality or confidence status where needed.
- Rules for missing or conflicting data.
- Named owner.

AI must never present generated or inferred information as a verified fact.

---

## 6. User Relationship Strategy

Planet Sport has already built large audiences. The next stage is to build stronger relationships with those users.

AI should help users:

- Follow teams, players, drivers and competitions.
- Receive personal match, race and news alerts.
- Get a useful daily or event briefing.
- See relevant stories, stats, rankings and results.
- Build watchlists and comparisons.
- Move smoothly between the website and app.
- Control their interests, data and notification choices.

Success should not be judged only by traffic or page views. Measure registrations, active users, return rate, retention, follows, alerts, app use and commercial value.

---

## 7. Web SEO and Authority

AI should help improve existing sites by finding:

- Missing or weak landing pages.
- Thin, duplicate, old or competing pages.
- Poor internal linking.
- Missing historical data.
- Broken links between players, teams, competitions and fixtures.
- Weak titles, headings, descriptions and structured data.
- Poor image size, naming, alt text, captions or credits.
- Search queries with strong impressions but weak clicks.
- Competitor features Planet Sport does not offer.
- Crawl, rendering, indexing, speed and mobile issues.

The long-term aim is original research, historical databases and transparent rating methods that deserve links and citations.

Important SEO content must be checked in the HTML search engines receive, not only in the page shown after JavaScript runs.

---

## 8. Apps and Social Engagement

AI should not simply create more posts or notifications. It should help the team understand what users value and create reasons to return.

### Apps

- Personal home screens.
- Team, player and driver follows.
- Deep links from web pages to app screens.
- Relevant alerts and push notifications.
- Event reminders and “what you missed” summaries.
- Fast, stable and useful mobile journeys.
- Store listing, review, retention and crash analysis.

### Social

- Find stories and data likely to create a response.
- Adapt the treatment for each platform.
- Turn data into polls, comparisons, charts and debates.
- Track comments, shares, saves, follows, visits and registrations.
- Understand fan sentiment without treating it as verified fact.
- Bring useful social discussion back into Planet Sport products.

The goal is meaningful engagement and stronger user relationships, not empty reach.

---

## 9. How AI Should Work

AI is expected to do most of the coding, research support, testing and documentation.

The human remains responsible for:

- Vision and priorities.
- User and business value.
- Product choices.
- Commercial judgment.
- Rights and legal decisions.
- Approval of material changes and releases.

### AI working rules

1. Read the repository, its instructions, documentation and tests first.
2. Understand what already works before suggesting replacements.
3. Separate verified facts, assumptions, estimates and recommendations.
4. Do not invent data, APIs, results, files, completed checks or business facts.
5. Ask when an unclear decision affects users, revenue, data, security, rights or core architecture.
6. Prefer small, testable and reversible changes.
7. Do not weaken tests, types or security checks to force a pass.
8. Add or update tests with every material change.
9. Keep secrets and personal data out of code, prompts, logs and Git.
10. Record major decisions and their reasons.
11. Show evidence for claims that something works.
12. Stop and report a blocker instead of guessing.
13. Do not leave the repository, build, development server or main user journeys broken.
14. Record baseline failures before changing code so new regressions cannot be dismissed as old issues.
15. A restart, rebuild, cache clear or hard refresh is acceptable when technically required, but explain why and prove the project works afterwards.

AI output is a proposal until the checks prove it works.

### Project stability rule

Cursor and Codex must leave each project in a known, supportable state.

For every material change:

1. Check Git status and preserve unrelated work.
2. Run the relevant baseline checks before editing.
3. Make the smallest safe change.
4. Run the full relevant checks after editing.
5. Test the changed feature and connected core journeys.
6. Inspect logs for new browser, server, database and build errors.
7. Confirm normal start-up and production build still work.
8. Remove debug code, temporary work and fake data.
9. Report the files changed, evidence collected and anything not verified.

If the agent causes a regression, fixing that regression becomes the immediate priority. It must not move to the next feature while leaving the project broken.

If the task cannot be finished, the agent must leave its own work in a safe, clearly explained state. It must never overwrite or revert unrelated user changes.

A blank page, failed build, new console error, broken route, missing data or unexplained warning is not an acceptable handover.

### Design fidelity rule

When the user supplies a design, screenshot, mock-up or existing page, treat it as the agreed visual target unless told otherwise.

Before implementation, produce a design-to-build map:

| Reference element | Delivery method | Inputs needed | Status |
| --- | --- | --- | --- |
| Layout or component | HTML, CSS and project-native component | Breakpoints and behaviour | Confirmed / unknown |
| Real text or data | CMS, API, database or approved static copy | Source and fallback | Confirmed / unknown |
| Photo or illustration | Existing or separately supplied asset | File, crop, rights and responsive sizes | Ready / missing |
| Icon or logo | Existing design system or approved asset | Correct file and usage rules | Ready / missing |
| Chart or visual data | Code-native chart using verified data | Data, labels and states | Confirmed / unknown |

The agent must then:

1. Identify what can be built accurately in code.
2. Identify what needs an image or other asset.
3. Reuse existing brand components and assets where suitable.
4. Ask about material unknowns rather than inventing them.
5. Avoid fake copy, numbers, images, controls and unsupported sections.
6. Keep text as accessible HTML unless it genuinely belongs in an image.
7. Implement desktop, mobile and interactive states.
8. Render the result at agreed viewport sizes.
9. Compare the result with the reference and correct visible differences.
10. Record deliberate differences, missing assets and unverified states.

Do not claim the design is complete because the structure exists. It must be visually checked for spacing, size, hierarchy, typography, colour, clipping, overlap, responsiveness and asset accuracy.

### Required design handover from Codex to Cursor

When Codex prepares a design task for Cursor, the handover should include:

- The exact reference images or pages.
- The purpose of the screen and main user action.
- The parts that must match closely.
- The existing components and assets to reuse.
- The data source for every dynamic value.
- A list of code-built elements versus image assets.
- Desktop and mobile sizes to verify.
- Interaction, loading, empty and error states.
- Elements Cursor must not invent or change.
- Acceptance checks and required comparison screenshots.

Cursor must inspect the actual reference and repository before coding. A text summary alone is not a substitute for reviewing the source design.

---

## 10. Proof and Quality Gates

No feature is complete only because it looks correct or an AI says it works.

Required evidence should include, where relevant:

- Clean installation.
- Passing type checks.
- Passing lint and formatting checks.
- Passing production build.
- Unit tests for important rules and calculations.
- Integration tests for databases, APIs and shared systems.
- End-to-end tests for main user journeys.
- Real browser checks on mobile and desktop.
- Real device or suitable app testing.
- Error, empty, slow and missing-data states.
- Security and dependency checks.
- Data-source and calculation checks.
- SEO, performance and accessibility checks.
- Independent review using fresh AI context.
- Human developer or security review for high-risk work.
- Comparison with the baseline to prove no new regression was introduced.

**Built is not Done. Working once is not Done. AI saying it works is not Done.**

### Recorded engineering learning — F1 historical importer

This project has already produced an important lesson that must be applied to future F1, Rugby and shared-data importers.

#### Failure 1 — read/write storage mismatch

The importer wrote compressed archive files such as `meetings.json.gz`, but early resume and calendar code tried to read an uncompressed path such as `meetings.json`. After the first write, later stages hit `ENOENT` and aborted.

The immediate fix was a shared `readRawJson()` path that reads either `.json.gz` or `.json` transparently.

The wider rule is:

- Define file names, paths and compression in one shared storage contract.
- Use the same shared functions for every read and write.
- Test a full write-and-read round trip using the actual stored format.
- Test stopping and resuming after data has already been written.
- Keep backward compatibility explicit and tested where old formats remain.
- Errors must state the expected path, actual path and recovery action.

#### Failure 2 — the launching shell exited

Later imports were stopped because the Cursor shell exited. This was separate from the gzip bug. Running the process under `screen` made the import more durable, but that is an interim operating method rather than the final job system.

The wider rule is:

- Long-running work must not depend on Cursor, Codex or one terminal remaining open.
- Save a checkpoint after each completed session or other safe work unit.
- Restart without downloading completed data again or creating duplicates.
- Keep logs and job status outside the launching shell.
- Support clean stop, resume, retry and failure reporting.
- The final system should use a managed job runner or worker appropriate to the project.

#### Rate-limit learning

At the time of the importer check, the documented OpenF1 free-tier limits were `3 requests/second` and `30 requests/minute`. The importer used a more cautious ceiling of `2.5 requests/second` and `25 requests/minute`.

Do not treat those figures as permanent. Before an import:

- Verify the current primary supplier documentation.
- Keep limits in configuration rather than scattered through code.
- Handle `429`, timeouts, network failures and partial responses.
- Use backoff and safe retry rules.
- Record the limit and documentation date in the import report.

#### Required acceptance test

For a season or competition import, prove this complete journey:

> Import the expected dataset, interrupt the process, restart it safely, avoid duplicate work, remain inside current supplier limits, validate every expected unit and produce a clear completeness report.

This lesson is now a permanent audit check for all data pipelines.

---

## 11. Commercial Outcomes

Every project must have at least one main user measure and one main business measure.

Possible outcomes include:

- More organic, direct and returning users.
- More registered and known users.
- Higher app installs, active use and retention.
- More follows, alerts, newsletter sign-ups and useful actions.
- Stronger advertising, sponsorship and branded-content products.
- Betting and affiliate value where suitable.
- Subscription or membership opportunities.
- Sports data, insight or tool licensing.
- Better partner products.
- Reduced cost or staff time.

Every recommendation should explain how it could create user value and business value. Do not invent a financial forecast when evidence is missing.

---

## 12. What the Final Product Looks Like

The final result is not one replacement website.

It is a connected Planet Sport product and intelligence system where:

- Existing brands and websites become better.
- Rugby365 and F1 Intelligence use shared data and standards.
- Planet Sport Intelligence continually finds and ranks improvements.
- Accounts connect user interests across products.
- Websites, apps, social and newsletters work together.
- Original data, rankings and methods build authority.
- AI helps the team research, decide, build, test and learn.
- Product results feed back into the next decision.
- The development team can understand, support and extend every release.

The strategic aim is:

> Turn Planet Sport from a group of websites that publish sports content into a sports intelligence business with trusted data, original products and direct relationships with fans.

---

## 13. Instructions for Cursor or Codex

When this document is provided with a repository, follow this sequence.

### Phase 1 — Inspect only

Do not implement product changes yet.

1. Read this document and `Planet-Sport-Build-Standard.md` in full.
2. Read all repository instructions and existing project documentation.
3. Inspect the codebase, current architecture, data model, tests and deployment setup.
4. Identify what is working and should be preserved.
5. Identify current links or possible links with Planet Sport Intelligence, Rugby365, F1 Intelligence and shared systems.
6. Audit code quality, data quality, SEO, performance, accessibility, security and test coverage.
7. Check for duplicate entities, unstable IDs and unclear sources of truth.
8. Inspect every importer or long-running job for storage symmetry, checkpoints, safe resume, durable execution, rate limits and completeness reporting.
9. Inspect supplied design references and map them to existing code, components, data and required assets.
10. Run safe existing checks and record the exact results.
11. Do not change production data, external systems or live services.
12. Do not install or upgrade packages unless needed for the audit and approved.

### Phase 1 deliverable

Return an evidence-backed report containing:

- Repository and branch inspected.
- Current system overview.
- What works and should remain.
- Main user and business purpose.
- Existing data sources and shared systems.
- Main gaps and risks.
- SEO and app discovery findings where relevant.
- Test, build and security results.
- Importer and background-job durability findings.
- Design-to-build map, missing assets and visual risks where references were supplied.
- Integration opportunities with the other intelligence projects.
- Ranked recommendations using value, evidence, effort and risk.
- Proposed first useful release.
- Questions or decisions required from the product owner.

Clearly label every item as one of:

- **Verified fact**
- **Assumption**
- **Recommendation**
- **Unknown / needs evidence**

Stop after the audit and wait for approval before implementation.

### Phase 2 — Agree the plan

After approval:

1. Turn the chosen opportunity into a product brief.
2. Confirm user value, commercial value and success measures.
3. Confirm what existing systems and data will be reused.
4. Agree the data model, IDs and sources of truth.
5. Agree SEO, app, security, rights and analytics needs.
6. Break the work into small tasks with acceptance checks.
7. Record exclusions and known risks.

Stop and obtain approval for material architecture, data, security, rights or commercial decisions.

### Phase 3 — Build and prove

After the plan is approved:

1. Implement one agreed task at a time.
2. Preserve working code and unrelated user changes.
3. Add tests with the code.
4. Run the required checks.
5. Review the result with fresh context.
6. Update documentation and the decision record.
7. Report evidence, remaining risks and the next recommended task.

Do not describe the project as complete until it meets the Planet Sport Definition of Done.

---

## 14. First Recommended Programme

### Workstream 1 — Planet Sport Intelligence

- Connect current analytics and search data.
- Build the common audit model.
- Define opportunity scoring.
- Create the recommendation and work-queue process.
- Link recommendations to Rugby365 and F1 Intelligence.
- Measure results after approved releases.

### Workstream 2 — Rugby365

- Audit current code and data.
- Complete the shared ID and source model.
- Check current rankings and methods.
- Identify missing public discovery and historical pages.
- Select one high-value rankings or player product to prove the model.

### Workstream 3 — F1 Intelligence

- Audit current code and data.
- Complete seasons, calendars, races, teams, drivers and circuits.
- Confirm current and historical data coverage.
- Compare the current product with PlanetF1 and competitors.
- Select one high-value live, historical or personal product to prove the model.

### Shared workstream

- Agree the common account approach.
- Agree stable cross-project IDs.
- Agree analytics events and success measures.
- Agree security, testing and release checks.
- Agree the handover and support model.

---

## 15. Project Decision Test

Before approving any major feature, ask:

1. Does it solve a real fan or team problem?
2. Does it improve an existing Planet Sport product?
3. Can it reuse current data, accounts, content or audience?
4. Is Planet Sport well placed to do it?
5. Can we explain the commercial value?
6. Can we prove it works and measure the result?
7. Can the development team support it?
8. Is it safe, legal and within our rights?

If several answers are unclear, investigate before building.
