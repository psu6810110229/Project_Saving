# Saving Plan UI Direction

Use this document if the mockup images in `docs/reference/` are not readable by the agent.

## Purpose

Update only the Saving Plan related UI so it feels consistent with the original Project_Saving visual direction while staying clean, minimal, and mobile-first.

This direction applies only to:

- `SavingPlan` / Change Plan page
- Saving Plan section/card on Dashboard

Do not redesign unrelated pages.
Do not change money calculations unless explicitly required by the current task.
Do not change `savings_logs`, Reconcile, charts, transfers, withdrawals, or partner approval flows.

## Visual Language

The UI should feel warm, soft, and focused.

Use:

- Large rounded cards
- Warm cream / peach / off-white surfaces
- Burnt orange as the primary action color
- Soft shadows
- Generous spacing
- Mono-style headings with subtle letter spacing
- Compact chips or pills for status
- Clear hierarchy with one primary action per screen

Avoid:

- Dense forms
- Long helper paragraphs
- Too many visible fields at once
- Technical labels such as `day_count`, `effective_from_date`, or `revision`
- Accounting jargon
- New design systems or visual styles that differ from the existing app

## Dashboard Saving Plan Card

The Dashboard Saving Plan section should feel like a hero insight card, not a report.

It should answer quickly:

1. Is the user ahead, behind, or on track?
2. What should they do next, if anything?
3. Is their saving habit healthy?

Recommended structure:

```text
Saving Plan
Ahead by ฿1,170              [On track chip]
Covered until 31 Oct 2027

Money                         Habit
Expected today ฿80             Last deposit 10d ago
Recorded ฿3,000                Stale

[Change plan]
```

Keep the card compact. It should not crowd the Dashboard.

### Required Dashboard Principles

- Separate Money status from Habit status visually.
- Money status should show ahead / behind / on track.
- Habit status should show last deposit / days since last deposit / active, at risk, stale, paused, or no deposits yet.
- Do not collapse money and habit into one score.
- Use short labels.
- Use chips for states such as `Ahead`, `Behind`, `On track`, `Stale`, `Paused`.
- Use `Change plan` as the main CTA.
- Avoid long explanations.
- If needed, use one short helper line only, such as: `Based on recorded deposits.`

## Change Plan Page

The Change Plan page should feel like a short guided setup, not a long settings form.

Recommended flow:

1. Choose plan type
2. Fill only the fields needed for that type
3. See a compact preview
4. Save

### Plan Type Selection

Use large selectable cards or pills:

- Daily
- Weekly
- Monthly
- Increasing daily

The selected option should be visually obvious.

### Fixed Daily / Weekly / Monthly

Show only the necessary fields:

- Amount
- Plan target, if editable
- Optional end date only if already supported and useful

Do not show increasing-daily-specific fields.

### Increasing Daily

For Increasing Daily, show these core fields immediately:

- Start amount
- Increase by
- Maximum daily amount
- Stop condition
- Plan target

Use concise copy:

- `Start amount`
- `Increase by`
- `Maximum daily amount`
- `Stop when`
- `Plan target`

Avoid verbose helper text. Use short helper text only when necessary.

### Increasing Daily Stop Conditions

Use a clear stop-condition selector:

- When target is reached
- After a number of days
- On a specific date

Default:

- When target is reached

Behavior:

- If `When target is reached` is selected, hide day count and end date.
- If `After a number of days` is selected, show only `Run this plan for`.
- If `On a specific date` is selected, show only `End date`.
- Never show `Run this plan for` and `End date` at the same time for Increasing Daily.

### Increasing Daily Preview

Show a compact preview card instead of long explanations.

Example:

```text
Preview
Estimated finish   31 Oct 2027
Saving days        500 days
Daily cap          ฿180
Expected total     ฿54,000
```

If the stop condition may not reach the target, show a calm short note:

```text
This may finish below your target.
```

Do not use long paragraphs.

## Copy Rules

Use concise English copy, matching the current app language.

Preferred labels:

- Saving Plan
- Change plan
- Save plan
- Expected today
- Ahead by
- Behind by
- On track
- Covered until
- Last deposit
- Habit
- Active
- At risk
- Stale
- Plan paused
- Maximum daily amount
- Stop when
- Estimated finish
- Saving days

Avoid:

- `day_count`
- `effective_from_date`
- `revision`
- `reconciliation`
- `ledger`
- long explanation paragraphs

## Interaction Rules

- Keep the deposit flow unchanged.
- Keep Check Balance unchanged.
- Do not ask Reconcile questions inside Saving Plan.
- Do not block deposits if habit is stale.
- Do not shame the user.
- Do not show fields that do not apply to the selected plan type.
- Validation messages should be short and specific.
- One primary button per screen: `Save plan`.

## Validation UX

Validation should guide without feeling harsh.

Examples:

- `Enter an amount.`
- `Maximum daily amount must be at least the start amount.`
- `Choose a future end date.`
- `Plan length must be at least 1 day.`

Validation must not reset the selected plan type.
Numeric inputs should allow temporary empty values while typing.

## Implementation Boundaries

Allowed:

- UI cleanup for SavingPlan / Change Plan page
- UI cleanup for Dashboard Saving Plan card
- Copy simplification
- Layout simplification
- Preview card improvement
- Stop-condition UI clarity

Not allowed in this UI cleanup:

- Changing `savings_logs`
- Negative savings logs
- Transfer / withdrawal flows
- Partner approval
- Reconcile difference allocation
- Chart overlays
- Pause/resume unless already part of the active task
- Broad dashboard redesign
- Refactoring unrelated components

## Final Quality Bar

The final UI should be understandable in a few seconds.

A user should not need to calculate days manually.
A user should not need to read a paragraph to understand which field matters.
A user should clearly understand whether the plan stops by target, days, or date.
A user should see money progress and habit status as two separate ideas.
