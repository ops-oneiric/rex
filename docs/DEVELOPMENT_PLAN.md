# Rex — Development Plan

> Status: **v1.0, approved.** All open questions use their defaults (Section 13), and 2FA is out of scope (D11).
> **Phases 0 to 4 are complete** (Section 11). Defaults can still be changed whenever you like; most of them are settings, not code.

---

## 0. Decisions so far

| # | Topic | Decision |
|---|---|---|
| D1 | Key date | **First input date** = the client's first payroll (go-live). It is the main date for choosing associates. |
| D2 | Fast start | Fewer than **20 business days** between assignment and first input = **fast start**. |
| D3 | Support models | **Hybrid** (1): one associate does PM and payroll. **Traditional** (2): 1 PM + 1 payroll. **PM model** (3): 1 PM + 2 payroll. **You choose** the support model; Rex recommends who fills each seat. |
| D4 | Capacity | **Weighted by workload.** Target is about **5–10 active main accounts** per associate. Associates should **not** have several clients with first input dates close together. |
| D5 | Top factor | **PTO near key dates is the main knock-out factor**, most of all for associates in the payroll role. |
| D6 | AI key | You enter your Claude API key in **Settings**. It is stored encrypted on the server. |
| D7 | Privacy | Sensitive identifiers are **coded before anything is sent to Claude**. **1:1 notes are sent as written.** |
| D8 | Hosting | Your own server. **No network restrictions**, so it is reachable from anywhere and the login has to be strong (Section 10). |
| D9 | Data | **No existing data to import.** Client fields are the ones you listed (Section 5.2). |
| D10 | Open questions | **All defaults in Section 13 adopted.** |
| D11 | Login | **No two-factor authentication.** Strong password rules, account lockout and per-IP rate limiting protect the login instead (Section 10). |
| D12 | Database layer | **Drizzle ORM** instead of Prisma (implementation choice): migrations run inside the app at startup, so the Docker image needs no extra CLI or engine binaries. |
| D13 | Home time zone | Rex has a **"Your time zone"** setting (default Central) that decides what "today" means, e.g. which PTO is current. |

---

## 1. What Rex is

Rex is a private, single-user web app for running your book of business:

1. **Associates**: who they are, which roles they can fill, what they're good at, when they're out, and how loaded they are.
2. **Clients**: from prospect to implementation to service, with the attributes that drive assignment.
3. **Assignments**: filling each seat of a client's support model with the right associate, with a Claude recommendation as the main feature.
4. **Cadence (1:1s)**: a date and free-text notes. Claude pulls out action items, strengths, weak points, skills and trends.
5. **Escalations**: a date and free-text details. Claude pulls out the client, the associates involved, category, severity, fault and root cause, and finds trends.

### Guiding principles

- **Minimal input, maximal inference.** Cadence and Escalations have exactly two inputs. Everything else is inferred, and you can review and correct it afterwards.
- **The model advises, you decide.** Recommendations and extracted fields are proposals. You accept, edit or override them, and Rex records your choice.
- **Hard rules in code, judgment in the model.** Business days, PTO knock-outs, date collisions and capacity are calculated exactly in code. Claude weighs those facts and explains its choice. It never does the date or load arithmetic itself.
- **Sensitive data never leaves unprotected.** Identifiers are swapped for codes on your server before any request to Claude (Section 7).
- **Everything auditable.** Each AI result is stored with exactly what was sent, the model used and the prompt version.

---

## 2. Technology stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js (App Router) + TypeScript** | One codebase for UI and server logic. Type safety from the database up to the UI. |
| Styling | **Tailwind CSS** with design tokens | Makes the glass/gradient look easy to keep consistent. |
| Components | Small in-house component set in the shadcn/ui style | Accessible, styled to Rex's look, no extra dependency. |
| Icons | **Lucide** line icons, including `Crown` for the logo | No emojis anywhere. A lint rule fails the build if one appears. |
| Charts | **Recharts** | Capacity timelines and escalation trends. |
| Database | **SQLite** via **Drizzle ORM** | Single user, so this needs no setup and is easy to back up. Migrations apply automatically at startup. |
| AI | **Anthropic Claude API**, official TypeScript SDK, default model `claude-opus-5-5` (changeable in Settings) | Strong multi-factor reasoning. Structured outputs give guaranteed-valid JSON. |
| Auth | Single admin, **argon2id** password hash, server-side sessions in an httpOnly cookie, lockout and rate limiting | No 2FA (D11), so the password rules and lockout carry the protection. |
| Secrets | API key encrypted at rest (**AES-256-GCM**), master key in a server environment variable | The key is never stored in plain text or sent to the browser. |
| Validation | **Zod** | One schema for forms, server actions and AI output. |
| Testing | **Vitest** (unit), **Playwright** (end-to-end) | Rules engine tested heavily. AI calls mocked in tests. |
| Deployment | **Docker Compose**: app + **Caddy** (automatic HTTPS) | One command to deploy on your server. |
| Backups | Nightly encrypted SQLite snapshot, 30-day retention | Protects your data from day one. |

---

## 3. UI and design system

### 3.1 Visual language

- **Primary color:** dark purple.
  - `--rex-primary-900: #2E1065` (sidebar, headings, primary buttons)
  - `--rex-primary-700: #5B21B6` (hover, active nav)
  - `--rex-primary-500: #8B5CF6` (accents, focus rings, charts)
  - `--rex-primary-100: #EDE9FE` (subtle fills, selected rows)
- **Background:** soft light-purple gradient fixed to the viewport, e.g. `linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 45%, #E9DDFB 100%)`, with one or two large, very soft blurred shapes for depth.
- **Glass surfaces:** `rgba(255,255,255,0.55)` fill, `backdrop-filter: blur(16px) saturate(140%)`, 1px `rgba(255,255,255,0.6)` border, soft purple-tinted shadow, 16px radius.
- **Typography:** Inter (or Geist), generous whitespace, tabular figures for numbers.
- **Status colors** (used sparingly, always with a text label): lifecycle stage, fast start, severity, capacity band, PTO conflict.
- **Logo:** a line `Crown` icon in a dark-purple rounded square, followed by "Rex". The favicon is the same crown.

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
- **Responsive:** desktop first. On a phone the sidebar becomes a slide-out drawer. **[Assumption]**

---

## 4. Domain rules

### 4.1 Client lifecycle

```
 PROSPECT  ──►  IMPLEMENTATION  ──►  SERVICE
 (pipeline)     (on book of          (off book; not counted
                 business; counts     toward capacity; kept
                 toward capacity)     for history and trends)
```

- Each stage change is recorded with a timestamp, so implementation durations can be reported later.
- Moving a client to **Service** automatically closes its assignments (end date set). History stays, but the client stops counting toward capacity.
- **Prospects** don't count toward capacity. Optionally you can place a **tentative hold** on an associate, shown as *projected* load. **[Q11]**

### 4.2 Support models and seats

| Support model | Seats Rex fills |
|---|---|
| Hybrid | 1 × **Hybrid** (PM + payroll) |
| Traditional | 1 × **PM**, 1 × **Payroll** |
| PM model | 1 × **PM**, 2 × **Payroll** |

- You set the support model on the client. The recommender fills every seat as a team.
- Each associate is marked with the roles they can fill (PM, Payroll, or both). Only associates who can do both are eligible for a Hybrid seat. **[Q10]**
- For PTO rules, a **Hybrid seat counts as a payroll seat** because it includes payroll work.

### 4.3 Business days and fast start

- **Business days** = weekdays minus holidays from a list in Settings (seeded with US federal holidays). **[Q8]**
- **Fast start** = fewer than 20 business days from the assignment date to the first input date. Rex calculates this live: on the Assign screen it uses today's date, and once assigned it is fixed to the actual assignment date.
- Fast starts are flagged on the client, add workload weight (Section 4.4), and tighten the PTO rules (Section 4.5).

### 4.4 Workload weight and capacity

Each client gets a **workload weight** scaled so a typical account ≈ **1.0**, which keeps your **5–10 accounts** target meaningful. Default formula, all values editable in Settings **[Assumption, adjust to taste]**:

```
weight = 0.5
       + employee band       (1–49: 0 | 50–199: 0.2 | 200–499: 0.4 | 500+: 0.6)
       + control count       0.1 × (controls − 1), max +0.5
       + payroll complexity  (1: 0 | 2: 0.1 | 3: 0.2 | 4: 0.3 | 5: 0.4)
       + implementation type (New Logo: 0.2 | Add Control: 0)
       + previous vendor     (adjustment per value, default 0)   [Q2]
       + fast start          +0.2
```

Example: 120 employees, 1 control, complexity 3, New Logo, normal start → 0.5 + 0.2 + 0 + 0.2 + 0.2 = **1.1**.

**Share of weight by seat [Q7]:** Hybrid 100%. Traditional: PM 40%, Payroll 60%. PM model: PM 40%, each Payroll 30%.

**Associate load = sum of their seat weights on Implementation clients.** Bands (editable): under 5 = *Available*, 5–8 = *Healthy*, 8–10 = *Full*, over 10 = *Over capacity*. Account count is shown next to it.

### 4.5 Assignment rules (deterministic, in code)

Applied in priority order. Your answers set the first two. The order of the rest is my proposal and can be changed in Settings.

| Priority | Rule | Effect |
|---|---|---|
| **1. PTO knock-out** | Payroll/Hybrid seat: any PTO from **5 business days before through 2 after** the first input date | **Excluded** from that seat (shown in a separate "Excluded" list with the reason, and you can still pick them). |
| | PM seat: PTO in the same window | Heavy penalty and a red flag. Not a knock-out. **[Q5]** |
| | Fast start: PTO between assignment and first input (payroll/hybrid seat) | Heavy penalty and a red flag |
| | PTO within ±3 business days of the benefits start date | Moderate penalty and a flag |
| **2. First input collisions** | Another active client of theirs has a first input date **within 5 business days** | Strong penalty, "Conflict" flag |
| | Within 6–10 business days | Mild penalty, "Close" flag **[Q6]** |
| **3. Capacity** | Projected load after this assignment vs. the 5–10 band | Penalty rises past 8, and is strong past 10 |
| **4. Capability fit** | Capability tags and proficiency vs. complexity, control count, employee count | Bonus for strong fit |
| **5. Time zone** | Offset between associate and client | Penalty per hour of difference **[Q9]** |
| **6. Experience** | Past accounts with the same implementation type and previous-vendor type | Small bonus |

Each candidate gets a **fact sheet** listing these values. That fact sheet is what Claude sees (Section 6).

---

## 5. Database design

Table and column sketches; final names are in the Drizzle schema (`src/lib/db/schema.ts`). Every table has `id`, `created_at` and `updated_at`.

### 5.1 Associates

**`associates`**

| Column | Type | Notes |
|---|---|---|
| name | text | Never sent to Claude (coded, see Section 7) |
| email | text, optional | Never sent to Claude |
| title | text, optional | |
| time_zone | text (IANA, e.g. `America/Chicago`) | |
| can_pm / can_payroll | boolean | Which seats they can fill. Both = Hybrid-eligible. |
| target_load | decimal, default 8 | Personal target within the 5–10 band |
| is_directly_managed | boolean | **Controls who appears in Cadence** |
| is_active | boolean | Inactive associates are excluded from recommendations but keep their history |
| capability_notes | long text | Free text about strengths and preferences. Sent to Claude after names and codes are scrubbed. |

**`capabilities`**: a list you control. Example seeds: Multi-Control, Large Employer (500+), Complex Payroll, Benefits-heavy, New Logo, Add Control, In-house Conversions, Time and Attendance, Integrations, Garnishments, Multi-State, Union / Certified Payroll. **[Q10]**

**`associate_capabilities`**: associate ↔ capability with **proficiency** (1 = learning, 2 = proficient, 3 = expert).

**`associate_pto`**: associate, start_date, end_date, partial-day flag, note. Entries for the same associate may not overlap, a partial day must be a single date, and one entry covers at most 120 days.

As built in Phase 1: names are unique (case-insensitive), so the privacy layer can map them unambiguously. Associates can be deactivated (kept for history, excluded from recommendations) or deleted (removes their capabilities and PTO).

### 5.2 Clients (your fields)

**`clients`**

| Column | Type | Notes |
|---|---|---|
| company_code | char(3), unique, uppercase | **Primary identifier** across the app. Coded before sending to Claude. **[Q1]** |
| display_name | text, optional | Optional label, never sent to Claude **[Q1]** |
| lifecycle_stage | `PROSPECT` / `IMPLEMENTATION` / `SERVICE` | |
| implementation_type | `NEW_LOGO` / `ADD_CONTROL` | |
| support_model | `HYBRID` / `TRADITIONAL` / `PM` | You choose; required before assigning |
| employee_count | integer | |
| first_input_date | date | Go-live / first payroll. The main assignment date. |
| benefits_start_date | date, optional | |
| time_zone | text (IANA) | |
| control_count | integer ≥ 1 | Number of companies |
| payroll_complexity | integer 1–5 | Scale descriptions editable in Settings **[Q3]** |
| previous_vendor | enum, see Q2 | **[Q2]** |
| notes | long text, optional | |

Stored or computed alongside: `assigned_on` (date the team was assigned), `is_fast_start` (computed), `workload_weight` (computed and recalculated when inputs change).

As built in Phase 2:
- Fast start and workload weight are **calculated on the fly** from the current settings and holiday list, never stored, so changing a weight or adding a holiday updates every client at once.
- "Business days to first input" counts the business days *after* the start date up to and including the first input date (assigned Monday, first input next Monday = 5).
- Before assignment, fast start is shown as a projection ("if assigned today"). Once Phase 3 sets `assigned_on`, it is fixed.
- Clients move one stage at a time, forward or back, each move recorded with an optional note. Prospects need only a company code or a name. Every other field becomes required for Implementation and Service.
- Company codes are exactly 3 letters or digits, stored uppercase and unique.

For prospects, fields can be filled in gradually. Everything above is required before a client moves to **Implementation**.

**`client_stage_history`**: client, from_stage, to_stage, changed_at, note.

**`holidays`**: date, name. Seeded with US federal holidays (observed dates) for 2026-2028. Settings can add a year's federal holidays in one click, plus your own days.

### 5.3 Assignments and recommendations

**`assignments`**: client, associate, seat (`HYBRID` / `PM` / `PAYROLL_1` / `PAYROLL_2`), status (`ACTIVE` / `ENDED`), start_date, end_date, end_reason (`UNASSIGNED` / `REPLACED` / `SERVICE`), source (`MANUAL` / `AI_ACCEPTED` / `AI_MODIFIED`), override_note.

As built in Phase 3:
- **Holds are assignments on prospects.** There is no separate TENTATIVE status. Holds count as *projected* load only, and become the real team when the client moves to Implementation.
- **Assigned-on date** = the first day the client had a team member while in Implementation. It fixes the fast-start flag.
- **One person per seat, one seat per person per client.** Replacing someone ends their assignment and keeps it in history. Unassigning on the same day deletes the record, since it was a correction rather than history.
- **Moving to Service** ends every active assignment (reason SERVICE). Moving back does not restore the old team.
- **Changing the support model** ends assignments in seats the new model doesn't have.
- **Guards:** associates with any assignment history can't be deleted, only deactivated. An associate's seat eligibility can't be narrowed while they hold a seat it would forbid.
- **PTO overrides:** assigning someone knocked out by PTO requires a reason, which is saved on the assignment.
- **Capability fit** matches client needs to the starter capability names: New Logo, Add Control, Multi-Control (more than 1 control), Large Employer (500+), Complex Payroll (complexity 4+), In-house Conversions, and Benefits-heavy (benefits start within 10 business days of first input). Renamed capabilities aren't matched by the rules engine, but Claude will still read every capability and note in Phase 4.
- **Rules engine score (0-100):** starts at 85, plus up to 15 for capability fit and up to 5 for experience. Deductions: PM-seat PTO −35, fast-start PTO −30, benefits PTO −15, each conflict −25 (max −50), each close collision −10 (max −20), 8 per load unit above "Full" and 15 per unit above "Over", and 2 per hour of time-zone difference. Every rule window, seat share and band is editable in Settings.

**`ai_recommendations`**: client, support model, **outgoing payload exactly as sent** (already coded), the alias map (kept separately on the server), output JSON, model, prompt version, outcome (`ACCEPTED` / `MODIFIED` / `REJECTED`), optional override reason, tokens and cost.

### 5.4 Cadence (1:1s)

Two inputs: **date** and **notes**. The associate comes from the page you start on (or a quick pick from directly managed associates only), so it isn't a separate input. **[Q12]**

- **`cadence_entries`**: associate_id, occurred_on, notes.
- **`cadence_insights`** (one per entry, AI-generated, regenerated if you edit the note): summary, action items (`{text, owner: me | associate, due_hint}`), strengths, weak points, skills demonstrated (mapped to capability tags where possible), themes, morale (`positive` / `neutral` / `concerned` + reason), follow-through on earlier action items, model, prompt version.
- **`action_items`** (shared with Escalations): source, associate, text, owner, status (`OPEN` / `DONE` / `DROPPED`), due date. **[Q13]**
- **`trend_reports`**: subject (associate / escalations / client), period, content, model, generated_at. Generated when you ask and cached.

### 5.5 Escalations

Two inputs: **date** and **details**.

- **`escalations`**: occurred_on, details, status (`OPEN` / `RESOLVED`, one click, not an entry field). **[Q14]**
- **`escalation_analyses`** (AI-extracted, editable, with a confirmed flag): summary, suggested client, suggested associates involved, category, severity (Low/Medium/High/Critical), fault party (Associate / Client / Internal process / Product or system / Third party / Shared / Undetermined), fault associate(s), fault rationale, root cause, preventable (yes/no/unclear), recommended actions (become action items), confirmed_at. **[Q15]**

Trend views use exact SQL counts over the *confirmed* fields (by fault, category, severity, associate, client, month, implementation type, fast start vs. normal) plus a narrative from Claude. An associate's Cadence trend report also covers escalations attributed to them.

### 5.6 System tables

- **`settings`**: weights, windows, bands, holidays, model, prompt options.
- **`secrets`**: the encrypted Claude API key (with key version and last 4 characters for display).
- **`audit_log`**: creates, edits, stage changes, AI accept/override, settings changes, logins.
- **`admin_user`**: username, password hash, failed-attempt count and lockout time.
- **`sessions`**: login sessions, stored as SHA-256 hashes of the browser's random token.

---

## 6. AI recommendation engine

### 6.1 Flow

```
 Client in Implementation (or prospect) with support model set ──► "Recommend team"
        │
        ▼
 [1] Rules engine (code, exact; Section 4.5)
     • Seats needed from support model
     • For every active associate who can fill a seat:
         PTO knock-outs / penalties, first input collisions,
         projected load, capability fit, time-zone offset, experience
     • Excluded candidates set aside with reasons
        │
        ▼
 [2] Privacy layer (Section 7): company codes and names → aliases
        │
        ▼
 [3] Claude (structured output)
     • System prompt: your rules and priorities, in plain language
     • Input: coded client profile + fact sheets for eligible candidates
     • Output: top 3 complete teams (every seat filled), each with
         fit score 0–100, per-factor notes, rationale, risks, confidence
        │
        ▼
 [4] Aliases mapped back to real names on the server
        │
        ▼
 [5] Review screen
     • Team cards with factor chips and red/amber flags
     • Each candidate's upcoming first input dates and PTO on a mini timeline
     • Accept / Swap one seat (facts re-checked live) / Choose manually
     • Outcome and optional override reason saved
```

### 6.2 Team-level reasoning

Seats are filled as a team, not one by one. For example, in the PM model Claude can weigh whether the two payroll associates' PTO and collision dates complement each other. Whether a teammate's coverage can soften a PTO knock-out in the PM model is **[Q5]**.

### 6.3 Model usage

- Official `@anthropic-ai/sdk`, model `claude-opus-5-5`, adaptive thinking, structured output validated against a schema.
- **API key** from Settings (decrypted on the server only for the call). A **"Test connection"** button checks it.
- Server-side model fallback is enabled so a rare refused request still returns an answer.
- The stable system prompt is cached to cut cost and latency on repeat calls.
- **Cost:** small at your volume, roughly a few cents to low tens of cents per call, shown per call.
- **If Claude is unavailable** (no key, outage), the rules-engine ranking is still shown, so you're never blocked.

### 6.3a As built in Phase 4

- One request per client covers all open seats. Seats already filled are sent as fixed members.
- Claude Opus 5.5 by default (changeable in Settings), effort `high`, structured output validated against a schema. Server-side refusal fallback (`fallbacks: "default"`) is on for every model except Haiku, which doesn't support it.
- The system prompt is versioned (`recommend-v1`) and cached. Each stored recommendation records the prompt version, model, tokens, estimated cost and duration.
- Every proposed team is re-checked in code: each open seat must be filled once by a distinct, eligible candidate. Teams that break the rules are set aside with a note. A recommendation can't be applied if the client's open seats have changed since it was made.
- You can swap any seat before accepting. Accepting records ACCEPTED, or MODIFIED if you changed anything, with an optional reason. "None of these" records REJECTED with an optional reason. Assignments made from a recommendation carry its id.
- Usage this month (calls, estimated cost, your decisions) is shown in Settings > Claude.

### 6.4 Quality check

You have no historical data, so together we'll write **10–15 realistic test scenarios** with the answer you'd expect. *As built:* ten scenarios live in `tests/fixtures/scenarios.ts`. Unit tests check them against the rules engine without calling the API. Running `ANTHROPIC_API_KEY=... npm run eval` sends them to Claude and checks the answers; it costs a few cents per scenario, so it runs on demand rather than in CI. Examples: a fast start where the best-fit payroll associate has PTO 3 days before first input; two strong candidates where one has a first input collision; a PM-model team where one payroll associate is near 10. These run as an automated check whenever the prompt changes.

---

## 7. Privacy layer (coding sensitive details)

**Where it happens:** in Rex's server code, **before** the request leaves your server. Claude can only protect data it never receives, so Claude itself doesn't do the hashing.

| Data | What Claude receives |
|---|---|
| Company code (e.g. `ABC`) | Random alias per request, e.g. `CLIENT_07` |
| Client display name | Never sent |
| Associate names and emails | Aliases, e.g. `ASSOC_03` |
| Employee count, control count, complexity, dates, time zones, implementation type, previous vendor | Sent as is (not identifying on their own) |
| Associate capability notes | Sent after scrubbing (see below) |
| **Escalation details** | Sent after scrubbing (see below) |
| **1:1 notes** | **Sent as written**, per your instruction |

**Scrubbing free text (escalations, capability notes):**

1. **Dictionary replacement:** every known company code (uppercase, whole word only, so ordinary words aren't touched), client display name, and associate full, first and last name is replaced with its alias. The roster sent alongside uses the same aliases, so Claude can still say "this involves `CLIENT_07` and `ASSOC_03`", and Rex maps that back to the real client and associate.
2. **Pattern scrubbing:** emails, phone numbers, SSN-like and FEIN/EIN-like numbers, and long account-like digit strings are replaced with `[REDACTED_EMAIL]` and similar tags.
3. **Preview:** a "Show what will be sent" panel displays the exact coded text. You can have it appear before every escalation analysis or keep it as an on-demand view.

**Limitation:** names Rex doesn't know (e.g., a client's HR contact) can't be caught by the dictionary. The pattern scrub and the preview cover most of this. You can also add a **"Other names to scrub"** list in Settings.

**Storage:** the coded payload is stored as the audit record of what left the server. The alias map is stored separately and never sent.

*As built in Phase 4:*
- Aliases are assigned in a random order for each request.
- First and last names are replaced only when capitalized, so words like "will" or "may" survive. Full names and display names match regardless of case. Company codes match as uppercase whole words only.
- The "Other names to scrub" list is in Settings > Claude.
- The end-to-end tests record the exact request sent to a local stand-in for the API, and fail if any real name, code, contact or email appears in it.

---

## 8. Cadence and Escalation analysis

- **On save:** the entry is saved immediately. Analysis runs in the background and appears within seconds. If the API fails, the entry is safe and "Retry analysis" appears.
- **Context:** for Cadence, the associate's previous few entries and open action items, to track follow-through. For Escalations, the coded client/associate roster (to match references) and that client's prior escalations.
- **Trend reports** (on demand, cached):
  - *Associate:* recurring themes, skill growth, persistent weak points, action-item follow-through, morale trajectory, related escalations, and talking points for the next 1:1.
  - *Escalations:* patterns by fault, category, client, associate, implementation type, and fast start vs. normal start, plus suggested process fixes.
- **Editing:** every extracted field is editable. Your edits are never overwritten by re-analysis.

---

## 9. Pages

| Page | Contents |
|---|---|
| **Dashboard** | Clients awaiting assignment (fast starts on top), capacity bars by associate, **first input timeline** for the next 60 days with collisions highlighted, upcoming PTO with conflict flags, open escalations, open action items, overdue 1:1s |
| **Clients** | Table plus Kanban by lifecycle stage, searchable by company code. Filters: stage, implementation type, support model, associate, fast start. Detail: profile, weight breakdown, team, stage history, escalations. |
| **Assign** | Queue of clients without a full team. "Recommend team" flow (Section 6). |
| **Associates** | Roster with load bars and next first input dates. Detail tabs: Profile & Capabilities, Clients, PTO, Cadence (if directly managed), Escalations, Trends. |
| **Cadence** | Directly managed associates with last meeting and days since. New entry (date + notes). Insights and trend reports. |
| **Escalations** | List with severity, fault and status chips. New entry (date + details). Review-and-confirm panel. |
| **Insights** | Capacity over time, first input density by week, fast start rate, escalations by fault/category/month, implementation durations, AI acceptance rate. |
| **Settings** | AI (API key, model, test connection, scrub list, preview behavior), assignment rules (weights, windows, bands, priority order), holidays, capabilities, complexity scale, password, backups and data export. |

Global: a command palette (Ctrl+K) to jump to any company code or associate.

---

## 10. Security and deployment

Because Rex is reachable from anywhere (D8), the login carries all the protection:

- **Single admin login**, argon2id password hash. The account is created on the server with a command (no public setup page), and the password must be at least 12 characters.
- **No 2FA** (D11). Instead: per-IP rate limiting (10 attempts per 15 minutes) plus account lockout after 5 failures (15 minutes, doubling up to 24 hours), and every login attempt is logged.
- Secure, httpOnly, SameSite=lax session cookie. Sessions end after 12 hours idle or 7 days in total. Changing the password signs out other browsers.
- No public pages except the login screen. `robots.txt` and headers block indexing. Security headers (HSTS, CSP, frame-deny).
- **HTTPS** automatically through Caddy and Let's Encrypt. This needs a domain name pointed at the server. **[Q16]**
- The **Claude API key** is entered in Settings, encrypted with AES-256-GCM using a master key that exists only in the server's environment, shown as `••••abcd`, and never logged or sent to the browser.
- **Backups:** nightly encrypted SQLite snapshot, 30-day retention, optional off-server copy, and "Download backup" in Settings.
- **Deploy:** `docker compose up -d`. Update with `git pull` and a rebuild. GitHub Actions runs lint, type-check and tests on every push.

---

## 11. Phased delivery

You review each phase before the next starts.

| Phase | Scope | You can... | Size |
|---|---|---|---|
| **0. Foundation** (done) | Repo, design tokens, glass components, sidebar, crown logo, login with lockout, database, settings with encrypted API key, CI, Docker | Log in and see the styled app | M |
| **1. Associates** (done) | CRUD, seat eligibility (PM/Payroll), capabilities + proficiency, capability notes, PTO, directly-managed flag, capability list and home time zone in Settings | Enter your roster | M |
| **2. Clients & lifecycle** (done) | Your client fields, company code validation, lifecycle + history, prospect pipeline, board view, business-day calendar with holidays, fast start flag, workload weight with editable formula, complexity scale | Enter your book of business and pipeline | M |
| **3. Assignments & rules engine** (done) | Seats per support model, manual assignment with ranked candidates, holds on prospects, capacity bands and load bars, PTO knock-outs with override, first input collisions, fact sheets, first input timeline, auto-close on Service, editable rule settings | Assign by hand with every rule visible | M |
| **4. AI recommendations** (done) | Claude integration, privacy layer, team recommendations, review/accept/swap/decline, history, usage, test scenarios | Get recommended teams | L |
| **5. Cadence** | Two-input entry, background analysis, action items, associate trend reports | Log 1:1s and get insights | M |
| **6. Escalations** | Two-input entry, scrubbing + preview, extraction and roster matching, confirm, fault alignment, trends | Log escalations and see patterns | M |
| **7. Dashboard & Insights** | Dashboard widgets, Insights charts, command palette | See everything at a glance | M |
| **8. Go-live** | Security review, backups, deploy to your server, short user guide | Use it in production | S |

Phases 5 and 6 share most of their machinery, so the second is quicker to build.

**Later features the structure supports:** calendar import for PTO, reminders (overdue 1:1s, PTO conflicts created after assignment, approaching first inputs), "what if" planning for the prospect pipeline, using your past override reasons to refine recommendations, weekly digest.

---

## 12. Testing strategy

- **Unit tests** for the rules engine: business days with holidays, fast start boundary (19 vs. 20 business days), PTO windows by seat, collision windows, workload weights, seat shares, lifecycle transitions.
- **Privacy tests:** company codes, names and patterns are always scrubbed, ordinary words are untouched, and alias mapping round-trips correctly.
- **AI contract tests** with recorded responses (no live calls in CI), plus the recommendation scenario suite (Section 6.4).
- **End-to-end tests** (Playwright): login, add associate, add client, assign, log 1:1, log escalation.

---

## 13. Defaults adopted

You approved the default for every question below (D10). They are kept here as a record, and any of them can be revisited.

**Clients**

- **Q1. Client identifier.** Is the 3-character company code the only identifier, or do you also want an optional display name (never sent to Claude)? Prospects may not have a code yet. *Default: optional display name. Code required before Implementation.*
- **Q2. Previous vendor.** You wrote "in house or new". Is this a two-option field (In-house vs. New), and what does "New" mean: coming from another payroll vendor, or new to outsourced payroll? Should the vendor name (e.g., a competitor) also be recorded? *Default: two options, In-house / New, no vendor name.*
- **Q3. Payroll complexity.** Is a 1–5 scale right? What would a 1 and a 5 look like? *Default: 1–5 with descriptions you can edit.*
- **Q4. Add Control continuity.** For an Add Control, should Rex prefer associates who already work (or worked) on that client's existing companies? This needs an optional link to the existing client. *Default: no link.*

**Assignment rules**

- **Q5. PTO knock-out details.** The default window is 5 business days before through 2 after first input, for payroll and hybrid seats. For the PM seat, should the same PTO also be a knock-out, or only a heavy penalty? In the PM model, can the second payroll associate's coverage soften a knock-out? *Default: PM = heavy penalty only. No softening.*
- **Q6. "Near each other".** How close do two first input dates have to be to count as a conflict? *Default: within 5 business days = conflict, 6–10 = close.*
- **Q7. Seat weights and "main accounts".** Does "main account" mean every account an associate is on, or only accounts where they hold the main seat? Do the default shares (Traditional PM 40% / Payroll 60%; PM model 40% / 30% / 30%) look right? *Default: as stated.*
- **Q8. Holidays.** Should business days exclude US federal holidays, a company holiday list, or both? *Default: US federal holidays, editable.*
- **Q9. Time zone.** How much does it matter? Same zone preferred, or is any US zone fine? *Default: small penalty per hour, flag at 3+ hours.*
- **Q10. Roles and capabilities.** Can every associate fill both PM and payroll seats, or are some PM-only or payroll-only? Can you share 5–10 capabilities that matter when choosing someone?
- **Q11. Prospect holds.** Do you want tentative holds on associates for likely prospects (shown as projected load)? *Default: yes, shown separately.*

**Cadence and Escalations**

- **Q12. Associate on 1:1s.** OK that the associate comes from the page you start on rather than being a third input? *Default: yes.*
- **Q13. Action items.** A checklist you can tick off, or read-only text? *Default: checklist.*
- **Q14. Escalation status.** Open/Resolved (one click), or a historical log only? *Default: Open/Resolved.*
- **Q15. Categories and fault.** Are the fault parties in Section 5.5 right? Any categories or severity definitions your org already uses? Is there an expected 1:1 frequency (weekly, biweekly) so Rex can flag overdue meetings? *Default: as listed, biweekly.*

**Deployment and look**

- **Q16. Domain.** Do you have a domain or subdomain for Rex (e.g. `rex.yourdomain.com`)? It's needed for automatic HTTPS. What OS is the server running? *Default: Ubuntu-style Linux with Docker.*
- **Q17. 2FA.** *Decided: no 2FA (D11).*
- **Q18. Look.** Light theme only? Is `#2E1065` close to the purple you have in mind? Will you use Rex on your phone? *Default: light only, `#2E1065`, desktop first.*
- **Q19. Maintenance.** Will you change the code yourself, or only use the app? *Default: written for easy handover either way.*

---

## 14. Next step

Phases 0 to 4 are done. **Phase 5 (Cadence)** is next:
- two-input 1:1 entries (date and notes) for associates you manage directly;
- background analysis by Claude: summary, action items, strengths, weak points, skills and morale;
- an action-item checklist;
- associate trend reports with talking points for the next 1:1.
