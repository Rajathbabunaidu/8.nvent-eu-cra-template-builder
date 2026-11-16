> **v1.1.0:** See [upgrade and test guidance](docs/UPGRADE_AND_TEST_v1.1.0.md) for deletion SQL, new inline answer authoring, important backend retention restrictions and the unchanged publication blocker.

# nVent EU CRA Hub — Page 2: Template Builder

**Version 1.1.0 (source candidate; see docs/UPGRADE_AND_TEST_v1.1.0.md) · WeWeb Vue 3 coded element · Supabase PostgreSQL**  
**Delivery:** One WeWeb page / one parent `src/wwElement.vue` component with five internal tabs. This repository is **not** five separate WeWeb pages.

## 1. What is included

| Tab | Live behavior |
|---|---|
| Template Setup | Select template/version; create a draft using `cra_tm_create_template_draft`; edit draft setup (with guards); clone a published version using the existing RPC. |
| Domain Builder | Left vertical domain navigator; horizontally adjacent unique-team contributor cards; stacked tools selected from active tool releases; edit sections, questions and answer options using existing Supabase save RPCs. |
| Review & Approval | One ordered domain-shared review stage sequence, configured across all contributors; eligible team membership on stages via 3A tables. No stage is also a valid configuration. Named reviewers are *not* assigned here. |
| Rules Overview | Grouped by domain → contributor → tool; conditional rule editor for domains, contributors, tools, sections and questions; risk/gap/issue rule editor for tool instances. Uses existing rule RPCs. |
| Validation & Publish | Run existing full validation; inspect returned checks; inspect publish eligibility; optional publication for drafts that do *not* use the new review-stage tables. |

**Global Preview** available on every tab: local-only contributor answers, basic conditional-rule simulation, a reviewer-stage view with Yes/No and mandatory No comments, and simulated targeted Holds. Preview **does not create** assessments, submissions, decisions or findings.

## 2. Repository layout

```text
nvent-eu-cra-template-builder/
├── package.json         # WeWeb CLI scripts, version 1.0.0
├── ww-config.js         # Properties shown in WeWeb settings
├── src/
│   ├── wwElement.vue    # The single Vue 3 parent component, all five tabs
│   ├── api.mjs          # Pure Supabase PostgREST/RPC adapter
│   └── logic.mjs        # Client-only local preview logic
├── tests/
│   └── api.test.mjs     # Lightweight API/preview static checks
└── docs/
    ├── BACKEND_MAPPING.md
    └── IMPORT_AND_CONFIGURATION.md
```

## 3. Import into WeWeb from GitHub

1. Extract the ZIP. Place the **contents of this repository directory at the root** of a new GitHub repository; do not push only `wwElement.vue`.
2. Do **not** put the Project URL, publishable key or any Supabase secret into the repository source.
3. Push the repository to GitHub, e.g. using GitHub Desktop or `git init`, `git add .`, `git commit`, set remote, `git push`.
4. In WeWeb workspace settings, connect GitHub (workspace Admin/Owner required).
5. In WeWeb dashboard go to **Coded components → Import element**, choose the repository and branch; wait for component build and set its version active.
6. Open the **Template Builder WeWeb page**, drag **EU CRA Hub — Template Builder** coded element onto the page. Make it page-wide (ideally the only main content element).
7. Edit the coded element's properties:
   - `Supabase Project URL` → `https://<your-project>.supabase.co`
   - `Supabase Publishable Key` → `sb_publishable_…`
   - `Actor user_profiles.id` → ID of an existing *development* `user_profiles` row.
   - `Initial Template Version ID` → optional; if omitted, the latest updated version is selected.
   - `Enable development writes` → **OFF** by default. Enable **only in a private development environment**.
   - `Enable publication` → **OFF** by default; requires explicit opt-in and passing safeguards.
8. No separate Supabase plugin is required because this coded element makes browser HTTPS calls to Supabase PostgREST and RPC directly. You may still use a native Supabase plugin elsewhere in the WeWeb project.

*WeWeb's component import documentation: https://developer.weweb.io/using-llms-to-generate-custom-coded-comps/using-claude-code.html and https://docv2.weweb.io/settings-billing-code-export/workspace-settings/components-tab.html.*

## 4. Browser connection requirements

The component sends the `apikey: sb_publishable_…` header to `GET /rest/v1/<table>` and `POST /rest/v1/rpc/<function>`. It requires:

- The public Data API/PostgREST enabled in Supabase.
- Appropriate **database grants** for the public/anon role on selected tables and RPCs; lack of grants produces a visible 401/403 error. The component cannot bypass permissions.
- Network/CORS access from the WeWeb project to the Supabase origin.
- `cra_tm_*` template data model and Query 3A–3H tables/functions already applied, as reported for the development environment.
- An existing actor `user_profiles.id` for functions requiring it. **A manually supplied ID is not authentication and must never be treated as identity verification.**

**Security:** Without Supabase Auth and appropriate RLS / server-side policy, public browser access to write-enabled tables and RPCs is unsafe. A publishable key is intentionally public; it is **not** an authorization control. Do not use this deployment pattern for production until backend permissions are hardened.

## 5. Important review/publication boundary

Queries 3A–3H created a **separate domain-shared** review foundation. The uploaded 2026-11-15 version of `cra_tm_build_template_snapshot`, `cra_tm_run_full_template_validation` and the clone/publish functions still reference the older contributor-owned review model. The component therefore:

- **allows** creating/editing domain-shared review stages and stage-to-team mappings in an unpublished draft;
- **blocks publishing any version with records in `cra_tm_domain_review_stages`**, even disabled stages, to avoid a silently incomplete immutable snapshot;
- does **not** implement reviewer assignment at assessment release, contributor auto-submissions or production execution UI; those belong to the Assessment scheduling/Active Assessments page, not Template Builder;
- may still allow publication of a zero-stage draft after existing backend validation passes, when `enablePublication=true` and the actor is set.

The backend integration and a live end-to-end review scenario remain unverified in this deliverable. **Successful 3A–3H SQL execution was reported; the live Supabase instance was not accessible to the package generator.**

## 6. Preview limitations and user experience

- Preview only evaluates straightforward QUESTION conditions using operators `EQUALS`, `NOT_EQUALS`, `CONTAINS`, `IS_EMPTY` or `IS_NOT_EMPTY` and `{ "value": ... }` style comparison values. More complex/unknown operator shapes are labeled as limited simulation and **not falsely simulated**.
- Tool releases and question types are loaded dynamically. New tool types in the catalogue still require their **actual tool-specific renderer/editor** implementation; a database entry alone is not a new working tool.
- Configuration uses existing RPCs; no extra database migrations or Python tests are required to import this frontend.
- The review-stage-to-team editor uses the existing 3A stage tables. Stage save and several team mapping calls cannot be atomic across separate browser requests; if one fails, refresh to inspect the partial result before retrying.
- Question codes and rule codes are preserved during edits. Changes to options/sections/questions are controlled by the underlying PostgreSQL functions.

## 7. Local checks (optional)

```bash
npm install
npm test
npm run build
```

The lightweight Node tests and JavaScript syntax checks were run during packaging. A full WeWeb CLI compilation, browser connection, data mutation and live validation **were not run** in the packaging environment (npm registry access was unavailable). The import/build in your WeWeb workspace is the next integration check; do not mistake this source package for a deployment verified against your Supabase project.

## 8. Workflow events exposed to WeWeb

- `template-selected`
- `draft-created`
- `draft-saved`
- `validation-completed`
- `template-published`

The events are raised through the standard WeWeb `trigger-event` emit contract. Published template versions remain immutable. Next Domain is **navigation only**, not completion.
