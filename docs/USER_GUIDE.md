# Rex user guide

Rex helps you run your team: who has capacity, who should take each new client, how your 1:1s are going, and what your escalations say. This guide covers setting Rex up and the everyday work. Setting up the server is in [DEPLOYMENT.md](DEPLOYMENT.md).

**Getting around:** the sidebar has every area. Press **Ctrl+K** (**Cmd+K** on a Mac), or click **Search**, to jump to any client by company code or name, any associate, or any page.

## 1. One-time setup

Work through these in order. The dashboard shows a "Getting started" checklist until the basics are done.

1. **Settings > Claude:** paste your Claude API key and press **Test connection**. Choose the model; the default is the most capable one.
2. **Settings > General:** set your time zone. It decides what "today" is, when 1:1s are due and when nightly backups run. Set how often you meet the people you manage (default every 14 days).
3. **Settings > Capabilities:** list the skills that matter when matching associates to clients, such as union payroll, multi-state tax or new logos.
4. **Settings > Clients and rules:**
   - Check the US federal holidays; business-day counts skip them.
   - Adjust the workload formula and the complexity scale if the defaults don't fit.
   - Review the assignment rules: the PTO windows, how close first inputs can be, and the capacity bands.
5. **Associates > Add associate:** add each person. Set which seats they can fill (PM, payroll or both), their target load, their time zone, and whether you manage them directly (only those appear in Cadence). Then rate their capabilities and add any PTO you know about.
6. **Clients > Add client:** add your current implementations, service clients and prospects.
7. **Settings > Backups and data:** press **Back up now** once to confirm backups work.

## 2. Clients and their lifecycle

Each client moves through **Prospect → Implementation → Service**.

- **Prospects** need only a company code (three characters: letters, digits or hyphens, such as `ACM` or `A-1`) and a name. You can place a *hold* on an associate for a prospect; it shows as a lighter segment on their load bar.
- **Implementations** need every field Rex uses to match a team: employee count, first input date, benefits start, time zone, number of controls, payroll complexity, previous vendor, implementation type and support model.
- **Moving to Service** ends the team's assignments. The client drops off everyone's load and stays in the history.

**Fast start:** a client with fewer than 20 business days between assignment and its first input. Fast starts are flagged everywhere and weigh more in workload.

The client page shows the workload breakdown, the team, stage history, and related escalations. **Clients** has a table and a board view, with filters for stage, type, support model, associate and fast start.

## 3. Assigning a team

**Assign** lists implementations without a full team, fast starts first. The support model decides the seats:

- **Hybrid:** one associate does project management and payroll.
- **Traditional:** one PM and one payroll associate.
- **PM model:** one PM and two payroll associates.

For each seat Rex ranks every associate. The rules engine works out the facts:

- **PTO knock-outs:** PTO near the first input rules out payroll and hybrid seats, and counts heavily against a PM.
- **First input collisions:** two go-lives within a few business days of each other for the same person.
- **Capacity:** a target of about 5 to 10 active accounts, weighted by workload.
- **Capability fit and time zone.**

You can assign by hand from the ranked list. To pick someone who was knocked out, you have to write a reason.

**Recommend team** asks Claude to propose complete teams using those facts. Before anything is sent, names and company codes are replaced with codes like `CLIENT_03` and `ASSOC_05`, and you can preview exactly what goes out. Accept a team, swap people before accepting, or decline it. Rex keeps your decisions and reasons.

## 4. Cadence (1:1s)

Cadence covers only the associates you manage directly.

1. Open **Cadence** and choose **Log 1:1** next to the person.
2. Enter just the **date** and your **notes**, written as you normally would.
3. Save. Claude reads the notes in the background (they're sent as written, without the person's name) and adds a summary, strengths, growth areas, skills shown, morale, and action items.

Work through action items from the associate's page or the dashboard: tick them done, drop them, edit them or add your own. When a later 1:1 suggests an item is finished, Rex offers **Mark done**; it never closes items by itself.

**Trends** on the associate's Cadence tab reads the last 90 days of 1:1s, plus their confirmed escalations. It finds recurring themes, weak points, skill growth and follow-through, and suggests talking points for your next meeting.

## 5. Escalations

1. Open **Escalations** and enter the **date** and the **details**: what happened, who was involved, and what the client said.
2. Optionally press **Preview what will be sent** to see the coded version: names, company codes and contact details replaced.
3. Save. Claude suggests the client, the people involved and who (if anyone) was at fault, the category, severity, root cause, whether it was preventable, and actions.
4. **Review and confirm.** Change anything that's wrong, choose which actions become action items, and press **Confirm**. Only confirmed escalations count in trends, so nothing is attributed to anyone until you agree.

Mark escalations **Resolved** when they're closed. The **Trends** tab shows counts by month, fault, category, severity, client and associate, plus Claude's reading of the patterns and suggested process fixes. Being involved in an escalation is never counted against anyone; only confirmed fault is.

## 6. The dashboard

- **Needs attention** appears only when something does: PTO conflicts near a first input, fast starts without a team, escalations to review, overdue 1:1s, failed backups, or repeated failed sign-ins.
- **Upcoming PTO** shows the next 30 days. It flags PTO near a first input (red) or a benefits start (amber) for clients the person already holds, including PTO added after they were assigned.
- **First input timeline:** go-lives in the next 60 days. Names in red have another go-live too close by.
- **Capacity:** everyone's weighted load against their target.

## 7. Insights

Choose 3, 6 or 12 months. Every chart has **Show as table** for exact numbers.

- **Capacity:** team load by week against the team's combined target, and first inputs per week for the next 26 weeks. Use it to spot crowded weeks before you assign.
- **Assignments:** fast start rate, the runway between assignment and first input, and the mix of support models.
- **Implementations:** how long clients take to reach Service, by implementation type.
- **Escalations:** by month and fault, by implementation type, and fast start versus normal start.
- **Claude:** how often you accept its recommended teams, and what it has cost.

## 8. Privacy: what Claude sees

| Feature | What is sent |
|---|---|
| Team recommendations | Coded facts only: `CLIENT_xx` and `ASSOC_xx`, dates, counts, rule results. No names or company codes. |
| Escalation review and trends | Your details with names, company codes, emails, phone numbers and ID numbers replaced. |
| 1:1 analysis and trends | Your notes as written (keep identifying details out of them), never the associate's name. |

Every Claude result has a "What Claude received" panel showing the exact text sent. Add nicknames or other names to scrub in **Settings > Claude**.

## 9. Security and backups

- **Settings > Security** lists the browsers signed in as you and recent sign-in attempts, and lets you sign out every other browser. Changing your password does that too.
- **Settings > Backups and data** lists the nightly encrypted backups (kept 30 days), has **Back up now**, and offers downloads. It also exports clients, associates, assignments, PTO, escalations, 1:1 notes and action items as spreadsheet (CSV) files.
- Backups can only be opened with the server's `REX_ENCRYPTION_KEY`. Keep a copy of it in your password manager. Restoring is covered in [DEPLOYMENT.md](DEPLOYMENT.md#restoring).

**If you're locked out** after too many wrong passwords, wait for the time shown, or reset the password on the server. That also clears the lock:

```bash
docker compose exec rex node scripts/set-admin.mjs
```
