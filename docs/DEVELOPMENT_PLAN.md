# Rex — Development Plan (Draft for Review)

> Status: **Draft v0.1, awaiting your answers to the open questions in Section 12.**
> Nothing below is final. Every assumption I made is marked **[Assumption]** so you can confirm or correct it.

---

## 1. What Rex is

Rex is a private, single-user web app for running your book of business:

1. **Associates**: who they are, what they're good at, when they're out, and how loaded they are.
2. **Clients**: from prospect to implementation to service, with the attributes that drive assignment.
3. **Assignments**: putting the right associate(s) on each incoming client, with a generative-model recommendation as the main feature.
4. **Cadence (1:1s)**: a date and free-text notes per meeting. The model pulls out action items, strengths, weak points, skills and trends.
5. **Escalations**: a date and free-text details. The model pulls out the client, the associates involved, category, severity, fault and root cause, and finds trends over time.

Later features plug into the same structure (see Section 10).

### Guiding principles

- **Minimal input, maximal inference.** Where you asked for two inputs (Cadence, Escalations), the form has exactly two. Everything else is inferred, and you can review and correct it afterwards.
- **The model advises, you decide.** Recommendations and extracted fields are always proposals. You accept, edit or override them, and Rex records what you chose.
- **Hard rules in code, judgment in the model.** Capacity math, PTO overlap and date collisions are computed exactly in code. The model weighs those facts and explains its choice. It never does arithmetic on raw data.
- **Everything auditable.** Each AI output is stored with the exact inputs it saw, the model used and the prompt version, so you can always see why it said what it said.

---

## 2. Recommended technology stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js (App Router) + TypeScript** | One codebase for UI and server logic. Server Actions keep forms simple. Type safety from the database up to the UI. |
| Styling | **Tailwind CSS** with design tokens | Makes the glass/gradient look easy to keep consistent. |
| Components | **shadcn/ui** (Radix primitives) | Accessible and unstyled by default, so the components get Rex's look and not a generic one. |
| Icons | **Lucide** | Clean line icons, and it includes `Crown` for the logo. No emojis anywhere. |
| Charts | **Recharts** | Trend charts for escalations and cadence. |
| Database | **SQLite** (single file) via **Prisma** ORM **[Assumption]** | You are the only user, so SQLite is fast, needs no setup and is trivial to back up. Prisma can move it to PostgreSQL later without rewriting the app. |
| AI | **Anthropic Claude API**, official TypeScript SDK, model `claude-opus-5-5` by default **[Assumption]** | Strong reasoning for multi-factor fit decisions. Structured outputs give guaranteed-valid JSON. The model can be changed in Settings. |
| Auth | Single admin account, password hashed with **argon2id**, httpOnly session cookie, optional TOTP 2FA | Fits "only I will access it". |
| Validation | **Zod** | One schema shared by forms, server actions and AI output parsing. |
| Testing | **Vitest** (unit), **Playwright** (end-to-end) | Capacity and scoring logic is unit-tested heavily. AI calls are mocked in tests. |
| Deployment | **Docker Compose**: app container + **Caddy** reverse proxy (automatic HTTPS) | One command to deploy on any Linux server. |
| Backups | Nightly encrypted SQLite snapshot (with optional off-server copy) | Your data is the asset, so backups come from day one. |

---

## 3. UI and design system

### 3.1 Visual language

- **Primary color:** dark purple.
  - `--rex-primary-900: #2E1065` (sidebar, headings, primary buttons)
  - `--rex-primary-700: #5B21B6` (hover, active nav)
  - `--rex-primary-500: #8B5CF6` (accents, focus rings, charts)
  - `--rex-primary-100: #EDE9FE` (subtle fills, selected rows)
- **Background:** soft light-purple gradient fixed to the viewport, for example `linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 45%, #E9DDFB 100%)`, with one or two large, very soft blurred color shapes for depth.
- **Glass surfaces:** cards and panels use `background: rgba(255,255,255,0.55)`, `backdrop-filter: blur(16px) saturate(140%)`, a 1px `rgba(255,255,255,0.6)` border, a soft purple-tinted shadow and a 16px radius.
- **Typography:** Inter (or Geist), generous whitespace, numbers in tabular figures.
- **Status colors** (used sparingly, always paired with a text label): lifecycle stages, severity and capacity bands.
- **Logo:** a simple line `Crown` icon in a dark-purple rounded square, followed by "Rex" in the wordmark. The favicon is the same crown.
- **Icons:** Lucide line icons only. **No emojis**, enforced by a lint rule that fails the build if an emoji appears in UI strings.

### 3.2 Layout

```
+--------------+-------------------------------------------------------+
|  [crown] Rex |  Page title                         [search] [+ New]  |
|              +-------------------------------------------------------+
|  Dashboard   |                                                       |
|  Clients     |   +-- glass card --+  +-- glass card --+              |
|  Assign      |   |                |  |                |              |
|  Associates  |   +----------------+  +----------------+              |
|  Cadence     |                                                       |
|  Escalations |   +-------------- glass table ----------------------+ |
|  Insights    |   |                                                 | |
|              |   +-------------------------------------------------+ |
|  ----------  |                                                       |
|  Settings    |                                                       |
|  Sign out    |                                                       |
+--------------+-------------------------------------------------------+
```

- **Left sidebar:** dark-purple glass, icon plus label, collapsible to icons only. The active item has a light pill highlight.
- **Sidebar items:** Dashboard, Clients, Assign, Associates, Cadence, Escalations, Insights, then Settings and Sign out at the bottom.
- **Responsive:** fully usable on a laptop. On a phone the sidebar becomes a slide-out drawer. **[Assumption: desktop first]**

---

## 4. Domain model

### 4.1 Client lifecycle

```
 PROSPECT  ──►  IMPLEMENTATION  ──►  SERVICE
 (pipeline;     (on book of          (off book; not counted
  can be held    business; counts     toward capacity; kept
  tentatively)   toward capacity)     for history and trends)
```

- Each stage change is recorded with a timestamp in a history table, so you can later see how long implementations take.
- When a client moves to **Service**, its assignments are closed automatically (end date set). The history stays, but the client no longer counts toward any associate's capacity.
- **Prospects** don't count toward capacity by default. Optionally you can place a **tentative hold** on an associate for a prospect. It shows as *projected* load, separate from actual load. **[See Question Q7]**

### 4.2 Service models (team size per account)

| Service model | Associates on account | Roles (to be confirmed, see Q4) |
|---|---|---|
| Hybrid | 1 | One associate covers everything |
| Traditional | 2 | e.g. Implementation Specialist + Payroll Specialist |
| PM | 3 | e.g. Project Manager + Implementation Specialist + Payroll Specialist |

The service model is stored on the client. Each assignment records the **role** the associate fills, and Rex checks that the number of active assignments matches the service model.

### 4.3 Capacity

Capacity is calculated from active assignments on clients in **Implementation** only.

- **Count load:** number of active implementation accounts.
- **Weighted load [Assumption, see Q6]:** each client gets a workload weight. A starting formula, adjustable in Settings:

  ```
  weight = 1.0
         + employee band   (1–49: 0 | 50–199: 0.5 | 200–499: 1.0 | 500+: 1.5)
         + 0.25 × (FEIN count − 1)
         + complexity      (1 → 0, 2 → 0.25, 3 → 0.5, 4 → 0.75, 5 → 1.0)
         + new logo bonus  (New Logo: 0.5 | Add Control: 0)
  ```

  For multi-associate accounts, the weight can be split by role (for example the PM carries 40%), also configurable.
- Each associate has an optional **target capacity**. Rex shows load as a percentage band: Available / Healthy / Stretched / Over.
- **Date collision load:** besides total load, Rex looks at *when* the work lands. Each client has **critical windows** around its payroll input date and benefits start date (default: 14 days before through 3 days after, configurable). An associate with three critical windows in the same week is riskier than one with the same total load spread out.

---

## 5. Database design

Table and column sketches (final names in the Prisma schema). `id` columns are CUIDs and every table has `created_at` / `updated_at`.

### 5.1 Associates

**`associates`**

| Column | Type | Notes |
|---|---|---|
| name | text | |
| email | text, optional | |
| title | text, optional | |
| time_zone | text (IANA, e.g. `America/Chicago`) | |
| working_hours_start / end | time, optional | Gives precise time-zone overlap |
| target_capacity | decimal, optional | Weighted units |
| is_directly_managed | boolean | **Controls who appears in Cadence.** Off for associates you don't manage. |
| is_active | boolean | Inactive associates are hidden from recommendations but keep their history. |
| capability_notes | long text | Free text about strengths and preferences. The model reads this. |
| hire_date | date, optional | Optional tenure signal |

**`capabilities`**: a list you control (name, description, category). Seeded with examples such as: Multi-FEIN, Multi-State, Union / Certified Payroll, Complex Benefits, Large Employer (500+), New Logo Implementations, Add Control / Conversions, Time and Attendance, Integrations / Third-party Data, Garnishments, PM-qualified, Spanish-speaking. **[See Q5]**

**`associate_capabilities`**: associate ↔ capability with a **proficiency level** (1 = learning, 2 = proficient, 3 = expert).

So "a field to designate their capabilities" is two things: structured capability tags (filterable and scoreable) **plus** a free-text notes field for nuance the model can read.

**`associate_pto`**: associate, start_date, end_date, type (PTO / holiday / leave / partial day), note.

### 5.2 Clients

**`clients`**

| Column | Type | Notes |
|---|---|---|
| name | text | |
| lifecycle_stage | enum: `PROSPECT`, `IMPLEMENTATION`, `SERVICE` | |
| deal_type | enum: `NEW_LOGO`, `ADD_CONTROL` | |
| service_model | enum: `HYBRID`, `TRADITIONAL`, `PM`, nullable | Can be left empty for prospects |
| time_zone | text (IANA) | |
| payroll_input_date | date | **[See Q2 for the exact meaning]** |
| benefits_start_date | date, optional | |
| fein_count | integer | |
| payroll_complexity | integer 1–5 | **[See Q3]** |
| complexity_factors | relation to capability tags | Requirements such as Multi-State or Union, matched against associate capabilities |
| employee_count | integer | |
| expected_start_date | date, optional | Mostly for prospects |
| prospect_likelihood | enum Low/Med/High, optional | |
| notes | long text | |
| parent_client_id | optional self-reference | Links an Add Control to its existing client/database |

**`client_stage_history`**: client, from_stage, to_stage, changed_at, note.

### 5.3 Assignments and recommendations

**`assignments`**: client, associate, role (enum from Q4), status (`TENTATIVE` for prospect holds, `ACTIVE`, `ENDED`), start_date, end_date, source (`MANUAL` / `AI_ACCEPTED` / `AI_MODIFIED`), recommendation_id (optional).

**`ai_recommendations`**

| Column | Notes |
|---|---|
| client_id | |
| input_snapshot (JSON) | Exactly what the model was given: client, candidates and computed facts |
| output (JSON) | Ranked teams, scores, rationale, risks |
| model, prompt_version | For audit |
| outcome | `ACCEPTED`, `MODIFIED`, `REJECTED` |
| override_reason | Optional short note when you pick differently. This becomes useful history later. |
| tokens / cost | For your visibility |

### 5.4 Cadence (1:1s)

Your **only two inputs** are the **date** and the **notes**. The associate isn't a separate input: you start a note from that associate's Cadence page (or pick them from a list of directly managed associates only), so it is attached by context. **[See Q9 to confirm]**

**`cadence_entries`**: associate_id, occurred_on (date), notes (long text).

**`cadence_insights`** (one per entry, AI-generated, regenerated if you edit the note):

| Field | Shape |
|---|---|
| summary | 2–4 sentences |
| action_items | list of `{text, owner: "me" or "associate", due_hint}` |
| strengths | list of strings |
| weak_points / growth areas | list of strings |
| skills_demonstrated | list, mapped to capability tags where possible |
| themes | short tags (e.g. "workload", "client communication", "confidence") |
| sentiment / morale | `positive`, `neutral`, `concerned` + one-line reason |
| follow_ups_from_prior | which earlier action items this note shows as done or still open |
| model, prompt_version, generated_at | audit |

**`action_items`** (shared by Cadence and Escalations): source_type, source_id, associate_id, text, owner, status (`OPEN` / `DONE` / `DROPPED`), due_date. These are created from the AI output and you can check them off. They are not part of the entry form. **[See Q10]**

**`trend_reports`**: subject_type (`ASSOCIATE`, `ESCALATIONS`, `CLIENT`), subject_id, period_start, period_end, content (JSON + narrative), model, generated_at. Generated when you ask (for example "Analyze last 90 days" on an associate) and cached.

### 5.5 Escalations

The same two inputs: **date** and **details** (free text).

**`escalations`**: occurred_on (date), details (long text), status (`OPEN` / `RESOLVED`, default `OPEN`; one click to resolve, so it isn't an extra entry input). **[See Q11]**

**`escalation_analyses`** (AI-extracted, editable, with a "confirmed" flag):

| Field | Notes |
|---|---|
| summary | |
| client_id (suggested) | Matched against your client list by name |
| associate_ids (suggested) | Matched against your associate roster |
| category | e.g. Payroll error, Tax, Benefits, Missed deadline, Communication, Data/Setup, System, Other **[See Q12]** |
| severity | Low / Medium / High / Critical |
| fault_party | Associate / Client / Internal process / Product or system / Third party / Shared / Undetermined |
| fault_associate_ids | If associate-attributed |
| fault_rationale | Why the model attributed fault this way |
| root_cause | |
| preventable | yes / no / unclear |
| recommended_actions | Becomes `action_items` |
| confirmed_at | Set when you review and accept (or edit) the alignment |

Trend views (**Insights → Escalations**) combine exact SQL aggregates over the *confirmed* structured fields (counts by fault, category, severity, associate, client and month) with a model-written narrative ("Three of the last five High-severity escalations trace back to setup in the first 30 days of New Logo implementations...").

Cross-feature link: when Rex generates a Cadence trend report for an associate, it also includes the escalations attributed to that associate, so 1:1 prep reflects both.

### 5.6 System tables

- **`settings`**: capacity weights, critical-window sizes, model name, recommendation count, and similar.
- **`audit_log`**: who/what/when for creates, updates, stage changes and AI accept/override.
- **`admin_user`**: a single row with password hash and optional TOTP secret.

---

## 6. AI recommendation engine (the core feature)

### 6.1 Flow

```
 You open an incoming client  ──►  "Recommend team"
        │
        ▼
 [1] Deterministic pre-processing (code, exact)
     • Determine service model + roles needed
     • Build candidate list: active associates (optionally pre-filter on hard requirements)
     • For each candidate compute facts:
         - current count load & weighted load vs. target
         - time-zone offset from client + working-hours overlap
         - PTO overlapping the client's critical windows (payroll input, benefits start)
         - other clients' critical windows colliding with this client's (same weeks)
         - capability match vs. client's complexity factors (with proficiency)
         - experience with deal type (New Logo vs Add Control) and similar size/FEIN count
         - for Add Control: who is/was on the parent client (continuity)
        │
        ▼
 [2] Model call (Claude, structured output)
     • System prompt: your assignment philosophy + factor priorities (from Settings)
     • Input: client profile + candidate fact sheets + capability notes
     • Output (validated JSON): top N team options, each with
         fit score (0–100), per-factor assessment, plain-English rationale,
         risks/warnings (e.g., "PTO 3 days before first payroll"), confidence
        │
        ▼
 [3] Review screen
     • Side-by-side cards for each recommended team, factor chips, risk flags
     • "Accept", "Swap associate" (then re-check facts live), or "Choose manually"
     • Store outcome + optional override reason
```

### 6.2 Why it's split this way

- Language models are good at weighing trade-offs ("strong multi-FEIN expert but stretched; second choice is lighter but has PTO near go-live") and explaining them. They are unreliable at date arithmetic and summing loads over many records.
- So Rex computes every number, and the model only sees clean facts. If the API is unavailable, you still get the fact sheet and a simple code-only ranking as a fallback.

### 6.3 Model usage details

- **SDK:** official `@anthropic-ai/sdk`. Model `claude-opus-5-5`, adaptive thinking, structured output against a Zod/JSON schema so results always parse.
- **Refusal fallback:** server-side model fallback is enabled so a rare refused request still returns an answer.
- **Prompt caching:** the stable system prompt and associate roster are cached, which cuts cost and latency on repeat calls.
- **Cost:** at your volume (one user, a handful of calls a day) API cost should be small, roughly a few cents to low tens of cents per recommendation or analysis. Rex shows the token cost of each call.
- **Prompt versioning:** prompts live in versioned files in the repo, and each stored output records which version produced it.
- **Data sent to the API:** only the fields needed. **[See Q14 on data sensitivity: we can send IDs and attributes instead of client names if required.]**

### 6.4 Quality check

Before you rely on it, we assemble about 10–20 past assignments where you know the right answer (or what you'd do now), run the recommender on them, and compare. This becomes a small regression test re-run whenever the prompt changes.

---

## 7. Cadence and Escalation AI analysis

- **On save:** the entry is saved immediately. Analysis runs in the background and appears within seconds (a "Analyzing..." state, then the insights panel). If the API fails, the entry is safe and a "Retry analysis" button appears.
- **Context given to the model:** for Cadence, the associate's previous few entries and their open action items, so it can track follow-through. For Escalations, the client and associate roster (names only) so it can match references, plus that client's prior escalations.
- **Trend reports** (on demand, cached):
  - *Associate:* recurring themes, skill growth, persistent weak points, action-item follow-through rate, morale trajectory, related escalations, suggested talking points for the next 1:1.
  - *Escalations:* patterns by fault, category, client, associate, lifecycle phase and deal type, plus suggested process fixes.
- **Editing:** every extracted field is editable. Your edits are kept and not overwritten by later re-analysis. Fields you changed are marked as confirmed by you.

---

## 8. Pages

| Page | Contents |
|---|---|
| **Dashboard** | Clients awaiting assignment, capacity heatmap by associate, upcoming critical windows (next 30 days), upcoming PTO, open escalations, open action items, next 1:1s due (overdue cadence flag) |
| **Clients** | Table plus Kanban by lifecycle stage. Filters: stage, deal type, service model, associate. Client detail: profile, team, stage history, escalations. |
| **Assign** | Queue of unassigned and tentatively held clients. "Recommend team" flow (Section 6). |
| **Associates** | Roster with load bars. Detail tabs: Profile & Capabilities, Clients (current/past), PTO, Cadence (if directly managed), Escalations, Trends. |
| **Cadence** | Directly managed associates with last meeting date and days since. New entry (date + notes). Insight panels. Trend report. |
| **Escalations** | List with severity/fault/status chips. New entry (date + details). Review-and-confirm panel for AI fields. |
| **Insights** | Charts: capacity over time, escalations by fault/category/month, implementation durations, AI acceptance rate. |
| **Settings** | Capability list, capacity weights, critical-window sizes, roles per service model, AI model choice, password/2FA, data export, backups. |

Global: a command palette (Ctrl+K) to jump to any client or associate, and CSV import/export for clients and associates.

---

## 9. Security and deployment

- **Single admin login:** username and argon2id password hash set at first run (or from environment variables). Secure, httpOnly, SameSite=strict session cookie with expiry. Rate limiting and lockout on failed logins. Optional TOTP 2FA (authenticator app). **[See Q15]**
- **Every route is protected,** with no public pages except the login screen. `robots.txt` blocks indexing.
- **HTTPS** is handled automatically by Caddy (Let's Encrypt) on your domain. Optional IP allowlist or VPN-only access.
- **Secrets** (API key, session secret) live in environment variables on the server, never in the repo.
- **Backups:** nightly SQLite snapshot, compressed and encrypted, 30-day retention, with an optional copy off the server. A one-click "Download backup" in Settings.
- **Deploying:** `docker compose up -d` on the server. Updates are `git pull` and rebuild. A GitHub Actions workflow runs lint, type-check and tests on every push.

---

## 10. Phased delivery

Each phase ends with something you can use, and you review it before the next phase starts.

| Phase | Scope | You can... | Size |
|---|---|---|---|
| **0. Foundation** | Repo setup, design tokens, glass components, sidebar layout, crown logo, login/session, database + migrations, CI, Docker | Log in and see the empty, styled app | M |
| **1. Associates** | CRUD, capability tags + proficiency, capability notes, PTO, directly-managed flag, CSV import | Load your roster | M |
| **2. Clients & lifecycle** | Client CRUD with all assignment factors, lifecycle stages + history, prospects pipeline, Kanban, Add Control parent link | Load your book of business and pipeline | M |
| **3. Assignments & capacity** | Manual assignment with roles per service model, capacity calculation (count + weighted), critical windows, collision detection, capacity heatmap, auto-close on Service | Assign by hand with full capacity visibility | M |
| **4. AI recommendations** | Fact-sheet builder, Claude integration, structured output, review/accept/override UI, recommendation history, code-only fallback, evaluation set | Get recommended teams for incoming clients | L |
| **5. Cadence** | Two-input entry, background AI analysis, action items, associate trend reports | Log 1:1s and get insights | M |
| **6. Escalations** | Two-input entry, AI extraction + roster matching, review/confirm, fault alignment, trend charts + narrative | Log escalations and see patterns | M |
| **7. Dashboard & Insights** | Dashboard widgets, Insights charts, command palette | See everything at a glance | M |
| **8. Hardening & go-live** | 2FA, backups, security review, deployment to your server, user guide | Use it in production | S |

Phases 5 and 6 share most of their machinery (two-input entry, background analysis, editable AI fields, trends), so the second is quicker to build.

### Future features (structure is ready for them)

Calendar sync for PTO (Outlook/Google ICS), reminders for overdue 1:1s and critical windows, email-in for escalations, "what if" capacity planning for the prospect pipeline, learning from your overrides (feeding past override reasons back into the recommender's guidance), weekly digest.

---

## 11. Testing strategy

- **Unit tests** for capacity weights, critical-window and PTO overlap, time-zone overlap, lifecycle transitions and auto-closing assignments. This is where correctness matters most.
- **Contract tests** for AI output: each prompt's response schema is validated, with recorded sample responses as fixtures (no live calls in CI).
- **Recommender evaluation set** (Section 6.4) re-run on prompt changes.
- **End-to-end tests** (Playwright) for login, add associate, add client, assign, log cadence, log escalation.

---

## 12. Open questions for you

Each has a default I'll use if you'd rather not decide now.

**Assignment factors**

- **Q1. Time zone matching.** Should the best match be the *same* time zone, or is anything within N hours fine? Do associates work fixed hours (e.g. 8–5 local)? *Default: prefer same zone, penalize per hour of difference, and flag more than 2 hours.*
- **Q2. "Payroll input date".** What exactly is it: the client's first payroll processing date (go-live), the date payroll data is due, or something else? Is there one date per client or one per FEIN? *Default: one first-payroll/go-live date per client.*
- **Q3. Payroll complexity.** How do you judge it today? Is a 1–5 rating good, or should Rex derive it from specific factors (multi-state, union, certified payroll, tipped, job costing, integrations, garnishments, multiple pay frequencies)? *Default: a 1–5 rating plus optional factor tags.*
- **Q4. Service model roles.** What are the role names in Traditional (2) and PM (3), and what does each role do? Is the service model decided before assignment (by you, or by rules such as employee count), or should the recommender suggest it? *Default: you pick the service model; roles as in Section 4.2.*
- **Q5. Capabilities.** Can you share your capability list (or a few examples)? Do proficiency levels (learning / proficient / expert) matter, or is a simple yes/no enough?
- **Q6. Capacity.** Do you think in "number of accounts" or weighted workload? Is there a target or maximum per associate? Does load vary by role (e.g. the PM role is lighter per account)? *Default: show both, with weighted as in Section 4.3.*
- **Q7. Prospects and capacity.** Do you want tentative holds on associates for likely prospects (shown as projected load)? *Default: yes, shown separately and never counted as actual load.*
- **Q8. Factor priority.** If factors conflict, which matter most? Please rank: time zone, capacity, PTO near key dates, capability match, deal type experience, continuity (Add Control). *Default: capability ≈ capacity > PTO risk > time zone > deal experience > continuity.*

**Cadence and Escalations**

- **Q9. Associate selection.** Is it OK that the associate for a 1:1 comes from the page you start on (or a quick pick), rather than counting as a third input?
- **Q10. Action items.** Should AI-extracted action items become a checklist you can tick off, or just appear as read-only text?
- **Q11. Escalation status.** Do you want Open/Resolved tracking (one click, not an input field), or are escalations a historical log only?
- **Q12. Escalation categories and fault.** Are the fault parties in Section 5.5 right for you? Any categories or severity definitions your org already uses?
- **Q13. Cadence frequency.** Is there an expected cadence (weekly / biweekly / monthly) so Rex can flag overdue 1:1s? Same for all directly managed associates?

**Data, AI and hosting**

- **Q14. Data sensitivity.** Rex will send client attributes, 1:1 notes and escalation details to the AI provider's API. Does your company have policies on sending client or employee data to external AI services? If so, Rex can send codes instead of client and associate names and map them back locally. Is there an approved AI vendor or an existing API key?
- **Q15. AI provider.** Are you happy with Anthropic Claude (my recommendation), or do you need a different provider for company reasons?
- **Q16. Server.** What will Rex run on: a personal VPS (DigitalOcean, Linode, Hetzner), a cloud VM (AWS/Azure/GCP), or a company server? Do you have a domain name? Should access be limited to certain networks (home/office IP, VPN)?
- **Q17. Second factor.** Do you want TOTP 2FA (authenticator app) on the admin login? *Default: yes, optional to turn on.*
- **Q18. Existing data.** Do you have spreadsheets of associates, clients or past 1:1 notes and escalations to import? If you share the column headers, I'll build the importers to match.

**Look and feel**

- **Q19. Dark mode.** Light only (per your description), or also a dark theme? *Default: light only for v1.*
- **Q20. Mobile.** Will you use Rex on your phone (e.g. logging a 1:1 right after a call), or desktop only? *Default: desktop first, phone usable.*
- **Q21. Shade check.** Is `#2E1065` close to the dark purple you have in mind? A hex code or reference image of your preferred shade would help.
- **Q22. Maintenance.** Will you be maintaining or modifying the code yourself, or is it purely for use? That affects how much I lean toward conventions versus simplicity.

---

## 13. Next step

Once you've answered (even partially), I will:

1. Update this plan into **v1.0** with your decisions locked in.
2. Start **Phase 0** (foundation: login, layout, design system), and share screenshots for a look-and-feel review before building features on it.
