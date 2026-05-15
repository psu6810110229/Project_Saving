# Task 24 - Native Thai UI And i18n

## Claude Usage Guide

This is a planning document only. Do not implement code from this plan until the user confirms the scope.

For implementation, read:

- For 24.1: sections 1, 2, 3, 7, 8, and 12.
- For Thai copy work: sections 4, 5, and the relevant phase in section 6.
- For notifications: sections 3, 5, 6.5, and 9.

GO-OUT is a mobile-first shared savings tracker for 2 people. Native Thai support should feel like product copy written for Thai users, not English strings translated word by word.

## Scope And Guardrails

Task 24 designs native Thai language support before Task 25 bucket correction.

Do not use this task to implement:

- Bucket correction.
- Money logic changes.
- `savings_logs` changes.
- Reconcile behavior changes.
- Saving Plan calculation changes.
- Unrelated refactors.
- A new i18n library unless a later implementation note proves the simple structure is insufficient.

English remains supported. Thai should be manually selectable, persisted, and intentionally written.

## 1. Current Repo Observations

### Where User-Facing Strings Live

The app currently has no i18n layer. User-facing strings are mostly inline in React pages and components, with additional copy in helper modules and Supabase Edge Functions.

Primary UI pages with direct copy:

- `src/pages/Dashboard.tsx`: project header, loading/error states, bucket creation messages, activity copy, chart labels, plan summary strings.
- `src/pages/AddMoney.tsx`: Add Money header, bucket setup empty state, deposit confirmation, error/success messages.
- `src/pages/CheckBalance.tsx`: Reconcile labels, Verified Balance, Actual Balance, Difference, reason selection, outcome modal.
- `src/pages/SavingPlan.tsx`: plan setup/edit form, preview copy, pause/resume states, validation messages.
- `src/pages/Profile.tsx`: Profile settings, create/join project, sign out, leave/archive confirmations.
- `src/pages/ManageProject.tsx`: project basics, saving controls, invite code, quick amounts, bucket management, archive/leave project.
- `src/pages/Notifications.tsx` and `src/pages/NotificationSettings.tsx`: notification center, settings toggles, permission state, empty/error/loading states.

High-copy components:

- `src/components/SavingPlanCard/SavingPlanCard.tsx`
- `src/components/BucketManager/BucketManager.tsx`
- `src/components/AddMoneyForm/AddMoneyForm.tsx`
- `src/components/ConfirmDepositPanel/ConfirmDepositPanel.tsx`
- `src/components/TotalVaultCard/TotalVaultCard.tsx`
- `src/components/HeadToHeadCard/HeadToHeadCard.tsx`
- `src/components/NudgeButton/NudgeButton.tsx`
- `src/components/Notifications/*`
- `src/components/BottomNav/BottomNav.tsx`

Helper modules with display copy:

- `src/lib/format.ts`: currency, relative time, local date labels.
- `src/lib/savingPlan.ts`: rule labels, money status labels, habit status labels, short date label.
- `src/lib/reconcile.ts`: reconcile reason labels and descriptions.
- `src/lib/notifications.ts`: notification category labels, grouping labels, route fallback behavior.
- `src/lib/battleNudge.ts`: competitive nudge/motivation copy.
- `src/lib/releaseNotes.ts`: release/update copy.

Server-side notification copy:

- `supabase/functions/send-nudge/index.ts`: nudge title/body/CTA and sender feedback.
- `supabase/functions/scheduled-saving-reminders/index.ts`: push title/body for saving reminders.
- Notification-related SQL migrations also enqueue stored English titles and bodies for some events.

### Existing Language Consistency Issues

- The product concept is now "Project" in UI, while some copy still says "Trip" such as `Trip Buckets` and `Trip Goal`.
- Navigation uses `Dashboard`, `Add`, and `Profile`, while page copy uses `Add Money`, `Deposit`, and `Confirm Deposit`.
- Financial terms mix conceptual layers: `Recorded Vault`, `Recorded Deposits`, `Verified Balance`, `Actual Balance`, `App balance`, and `Difference`.
- Dashboard copy has gamified language such as `Progress Race`, `Leading by`, and nudge/battle copy. Literal Thai would sound stiff or too competitive.
- Amounts already display as THB with Thai locale conventions in `formatCurrency`, but surrounding dates and relative time are English (`Today`, `Yesterday`, `just now`, `1d ago`, `May 28`).
- Notifications are stored and pushed with English titles/bodies. The Notification Center can eventually render localized copy from `event_key` and payload, but push copy must be chosen server-side.
- Some preview/dev pages under `AtomsPreview`, `MoleculesPreview`, and `OrganismsPreview` include English sample copy. These should be deferred unless they affect production routes.

### Components And Pages With Heavy Copy

Highest priority:

- Dashboard, including `TotalVaultCard`, `HeadToHeadCard`, `SavingPlanCard`, bucket section, activity feed, loading/error states.
- Add Money flow, including bucket picker, quick amounts, confirm deposit, outcome modal, slip field, bucket setup.
- Check Balance and inline Verified Balance inside `SavingPlanCard`.
- Saving Plan setup/edit and pause/resume flows.
- Profile and Manage Project settings.
- Notifications center/settings and push templates.

## 2. Product Language Strategy

English remains the default supported language. Thai is a first-class supported language, not a fallback translation.

Requirements:

- Users can manually choose `ไทย` or `English`.
- Do not rely only on browser language. Browser language may be used only as a first-run hint if the product wants it later.
- Language choice should persist across reloads.
- Prefer account-level persistence for signed-in users, with local storage as an immediate cache and unauthenticated fallback.
- Thai copy should be written around the screen context, not the English key.
- Names, project names, bucket names, and invite codes remain user-generated and should not be translated.
- Money values keep financial precision. Do not change calculations, rounding semantics, source tables, or Saving Plan logic.

Recommended persistence:

- Add a profile-level language preference such as `profiles.ui_language` with allowed values `en` and `th`.
- Cache the selected language in localStorage, for example `goout:ui-language`, so the app can render immediately before profile fetch completes.
- Resolution order: localStorage explicit choice, profile value when fetched, default `en`.
- When the user changes language, update UI immediately, write localStorage, then save the profile preference when authenticated.

Why profile-level persistence matters:

- GO-OUT is authenticated and likely used across devices.
- Server-side push notifications need a recipient language eventually.
- Profile settings already hold user-level preferences such as theme color and quick amounts.

## 3. Recommended i18n Architecture

### Recommendation

Use a simple internal i18n structure for Task 24. Do not add an i18n library for the first implementation.

Reasons:

- Only two languages are required now.
- The app already uses React and TypeScript without an i18n dependency.
- Thai has no plural suffix complexity like English, and most dynamic strings can be handled with typed functions.
- A library would add migration overhead before the team has validated the Thai copy surface.

Revisit a library only if the app later needs many locales, extraction tooling, translator workflows, ICU message syntax, or runtime-loaded translation bundles.

### Suggested Files

Create a small i18n folder:

- `src/i18n/languages.ts`
- `src/i18n/locales/en.ts`
- `src/i18n/locales/th.ts`
- `src/i18n/messages.ts`
- `src/i18n/I18nProvider.tsx`
- `src/i18n/useI18n.ts`
- `src/i18n/formatters.ts`
- `src/i18n/notificationCopy.ts`

If profile persistence is implemented:

- Add a migration such as `supabase/migrations/0045_profile_ui_language.sql`.
- Extend `src/types/index.ts` `Profile`.
- Extend `src/hooks/useProfile.ts` or create a smaller `useLanguagePreference` hook.

### Dictionary Shape

Prefer typed nested dictionaries over loose string keys:

```ts
// en.ts
export const en = {
  nav: {
    dashboard: 'Dashboard',
    add: 'Add',
    profile: 'Profile',
  },
  dashboard: {
    recordedVault: 'Recorded Vault',
    progressRace: 'Progress Race',
    noActivityTitle: 'No activity yet',
    startedWith: (amount: string) => `Start with ${amount} and let the streak begin.`,
  },
} as const;

export type Messages = typeof en;
```

```ts
// th.ts
export const th: Messages = {
  nav: {
    dashboard: 'หน้าหลัก',
    add: 'เพิ่มเงิน',
    profile: 'โปรไฟล์',
  },
  dashboard: {
    recordedVault: 'ยอดเงินรวมของทุกคน',
    progressRace: 'ความคืบหน้าของทุกคน',
    noActivityTitle: 'ยังไม่มีความเคลื่อนไหว',
    startedWith: (amount) => `เริ่มจาก ${amount} ก็พอ`,
  },
};
```

This catches missing Thai keys at build time without introducing a complex key parser. If dot-path keys are preferred later, derive them from `Messages`, but avoid overbuilding in 24.1.

### Hook And Provider

Expose:

- `language`
- `setLanguage(nextLanguage)`
- `copy` or `messages`
- `formatMoney(amount)`
- `formatDate(dateOrKey, options)`
- `formatRelativeTime(iso)`
- `displayNameForSelf(name)` if useful for `You` vs `คุณ`

Example usage:

```ts
const { copy, formatMoney } = useI18n();

<SectionLabel>{copy.dashboard.recordedVault}</SectionLabel>
<p>{copy.dashboard.startedWith(formatMoney(100))}</p>
```

### Dynamic Values

Do not rely on string replacement for all dynamic copy. Use typed functions in the dictionary when grammar or word order changes by language.

Use this approach:

- Amounts: format first with `formatMoney`, then pass into copy functions.
- Dates: format through `formatDate` or `formatDateKey`, then pass into copy functions.
- Names: pass raw display names into copy functions, with fallback handled by language-aware helpers.
- Counts: use dictionary functions because English needs plural handling and Thai usually does not.
- Statuses: map stable enum values to localized copy near the i18n layer.

Examples:

- English: `Ahead by {amount}`
- Thai: `เร็วกว่าแผน {amount}`
- English: `{count} active buckets`
- Thai: `มี {count} เป้าย่อย`

### Formatting

Separate language selection from money semantics.

- Money remains THB display. Do not change numeric source values or calculations.
- Keep `฿` unless a later brand decision changes it.
- Use Arabic digits in Thai UI unless the product explicitly chooses Thai numerals.
- Add locale-aware date and relative-time formatters:
  - English: `Today`, `Yesterday`, `1d ago`, `May 28`.
  - Thai: `วันนี้`, `เมื่อวาน`, `1 วันที่แล้ว`, `28 พ.ค.`.
- Saving Plan date boundaries remain Bangkok-local as they are today. i18n should not change that logic.

### Avoiding Huge Rewrites

Use a phased conversion:

- Add foundation first with English messages matching current UI.
- Convert production routes only, not preview pages.
- Start at page-level strings and pass localized labels into leaf components where practical.
- Keep shared layout components mostly language-agnostic.
- Convert helper label maps (`MONEY_STATE_LABEL`, `RECONCILE_REASONS`, notification labels) after the pages using them are moved to i18n.
- Keep missing-key fallback to English during migration, but track missing Thai keys in development.

### Notification Copy Strategy

Notification Center:

- Prefer rendering known notifications from `event_key` plus `payload` through `src/i18n/notificationCopy.ts`.
- Fall back to stored `title`, `body`, and `cta_label` for legacy rows or unknown event keys.
- This avoids rewriting historical notification rows.

Push notifications:

- Push payloads are generated server-side, so 24.5 should use the recipient's persisted language.
- `send-nudge` and `scheduled-saving-reminders` should choose title/body/CTA from a small server-side copy map.
- SQL-enqueued notifications should either store canonical payload fields for client rendering or be updated with language-aware templates only when server language access is clear.
- Do not block 24.1 on server-side notifications. Foundation first.

## 4. Thai UX Copy Principles

Thai copy must be:

- Short.
- Natural.
- Friendly but not childish.
- Product-native rather than literal.
- Precise for financial meaning.
- Calm around savings behavior.

Avoid:

- Awkward transliteration when a natural Thai UI term exists.
- Literal nouns like "การแข่งขัน" for every "race" context.
- Banking/legal tone unless the screen is genuinely about verification or permission.
- Shame or guilt language around missed deposits.
- Overusing polite particles. A few friendly loading or empty states can use them, but every line should not end with `ครับ` or `ค่ะ`.
- Copy that implies GO-OUT holds or moves real money.

Preferred style examples:

- Loading: `สักครู่ รออีกนิดเดียว`
- Progress Race: `ความคืบหน้าของทุกคน`
- Recorded Vault: `ยอดเงินรวมของทุกคน`
- Empty activity: `ยังไม่มีความเคลื่อนไหว`
- Nudge sent: `ส่งสะกิดให้ {name} แล้ว`
- Behind by amount: `ยังขาดจากแผน {amount}` instead of a shaming phrase.

Financial precision rules:

- `ยอดที่บันทึกไว้` means recorded in the app.
- `ยอดที่เช็กแล้ว` means checked/verified against actual savings.
- `ยอดจริง` means the real cash/bank/storage total entered by the user.
- `ส่วนต่าง` means the difference between actual and verified/app balance.
- Never imply a Check Balance difference was assigned to a bucket.

## 5. Terminology Glossary

| English | Recommended Thai | Notes |
|---|---|---|
| Dashboard | หน้าหลัก | Use for nav and page title. Avoid `แดชบอร์ด`. |
| Add | เพิ่มเงิน | Use in bottom nav because the action is money entry. Generic buttons can use `เพิ่ม`. |
| Profile | โปรไฟล์ | Natural for account/profile area. Settings copy can say `ตั้งค่า`. |
| Recorded Deposits | ยอดฝากที่บันทึกไว้ | Precise when referring to positive `savings_logs`. |
| Verified Balance | ยอดที่เช็กแล้ว | Short and natural. Use helper copy when explaining Check Balance. |
| Saving Plan | แผนเก็บเงิน | Product-native and clear. |
| Check Balance | เช็กยอดจริง | User is entering/checking real savings outside the app. |
| Actual Balance | ยอดจริง | Short in forms. Helper can say cash/bank/storage set aside. |
| Difference | ส่วนต่าง | Standard and concise. |
| Progress Race | ความคืบหน้าของทุกคน | Avoid literal competition language. |
| Saving reminder | เตือนเก็บเงิน | Short for settings and notification category. |
| Nudge | สะกิด | Natural, light, not punitive. |
| Bucket | เป้าย่อย | Avoid literal `ถัง`. Use for savings sub-goals. |
| Plan paused | พักแผนอยู่ | Clear current state. |
| Ahead | เร็วกว่าแผน | Use with amount: `เร็วกว่าแผน {amount}`. |
| Behind | ยังขาดจากแผน | Softer than `ตามหลัง`. Use with amount. |
| On track | ตรงตามแผน | Clear and compact. |
| Covered until | พอถึง {date} | Natural for credit-forward coverage. |
| Notifications | การแจ้งเตือน | Standard settings term. |
| Activity | ความเคลื่อนไหว | Better than literal `กิจกรรม` for project updates. |

Glossary highlights:

- `Recorded Vault` should become `ยอดเงินรวมของทุกคน`, not a literal vault metaphor.
- `Progress Race` should become `ความคืบหน้าของทุกคน`, not `การแข่งขัน`.
- `Bucket` should become `เป้าย่อย`, not `ถัง`.
- `Verified Balance` should become `ยอดที่เช็กแล้ว`, not a formal banking phrase.
- `Nudge` should become `สะกิด`, but use it gently.

## 6. Implementation Phases

### 24.1 i18n Foundation And Language Setting

Goal: add the language infrastructure and a working language switch without translating the whole app yet.

Scope:

- Create internal i18n message files with English and Thai.
- Add `I18nProvider` around the app.
- Add `useI18n`.
- Add `formatMoney`, `formatDate`, and `formatRelativeTime` wrappers.
- Add manual language setting in Profile.
- Persist language in localStorage and, if approved for the foundation, `profiles.ui_language`.
- Convert only the language switch UI, BottomNav labels, basic app loading/fallback copy, and one small Dashboard proof point.
- Keep English fallback for untranslated surfaces.

Do not:

- Convert every screen.
- Touch money calculations.
- Touch `savings_logs`.
- Touch bucket correction.
- Add a third-party i18n library.

Acceptance for 24.1:

- User can switch between `ไทย` and `English`.
- Choice persists after reload.
- Bottom navigation reflects the selected language.
- Fallback to English works for missing Thai keys.
- Build and lint pass.

### 24.2 Core Navigation And Dashboard

Goal: make the primary daily screen feel native in Thai.

Scope:

- Bottom navigation.
- App/page headers.
- Dashboard loading, empty, and error states.
- Project header.
- Recorded Vault.
- Progress Race.
- Saving Plan card summary.
- Bucket section labels and CTA.
- Activity section and merged activity rows.
- Chart labels and accessibility descriptions.

Key Thai copy:

- `Recorded Vault` -> `ยอดเงินรวมของทุกคน`.
- `Progress Race` -> `ความคืบหน้าของทุกคน`.
- `Activity` -> `ความเคลื่อนไหว`.
- `No activity yet` -> `ยังไม่มีความเคลื่อนไหว`.

Watchouts:

- Thai strings may be longer in section labels.
- Dashboard cards use tight mobile layouts.
- Avoid making competitive copy harsher in Thai.

### 24.3 Add Money, Buckets, And Manage Project

Goal: localize deposit entry and project/bucket management without changing behavior.

Scope:

- Add Money page.
- Bucket picker and bucket setup empty state.
- Add Money form labels.
- Confirm Deposit panel.
- Deposit outcome modal.
- Bucket creation/edit/delete copy.
- Manage Project settings rows.
- Invite Code, Trip Goal/Project Goal, Quick Amounts.
- Create/join project flows if they are part of current production usage.

Recommended Thai direction:

- `Add Money` -> `เพิ่มเงิน`.
- `Deposit to a bucket` -> `ใส่เงินเข้าเป้าย่อย`.
- `Confirm Deposit` -> `บันทึกยอดนี้`.
- `Bucket` -> `เป้าย่อย`.
- `Trip Goal` should be reconsidered as `เป้าหมายโปรเจกต์` unless the product is intentionally travel-only on that screen.

Do not:

- Change bucket math.
- Change target validation.
- Change create/update/delete flows.

### 24.4 Reconcile And Saving Plan

Goal: make financial confidence and plan tracking clear in Thai.

Scope:

- Check Balance page.
- Inline Verified Balance in `SavingPlanCard`.
- Reconcile reason labels and descriptions.
- Saving Plan setup/edit page.
- Saving Plan pause/resume copy.
- Money and habit status labels.
- Date labels such as covered-until and estimated finish.

Recommended Thai direction:

- `Check Balance` -> `เช็กยอดจริง`.
- `Verified Balance` -> `ยอดที่เช็กแล้ว`.
- `Actual Balance` -> `ยอดจริง`.
- `Difference` -> `ส่วนต่าง`.
- `Saving Plan` -> `แผนเก็บเงิน`.
- `Plan paused` -> `พักแผนอยู่`.
- `Ahead by {amount}` -> `เร็วกว่าแผน {amount}`.
- `Behind by {amount}` -> `ยังขาดจากแผน {amount}`.
- `Covered until {date}` -> `พอถึง {date}`.

Do not:

- Change Reconcile semantics.
- Convert differences into deposits.
- Allocate differences into buckets.
- Change Saving Plan calculations or pause logic.

### 24.5 Notifications

Goal: localize notification UI and prepare server copy for Thai push notifications.

Scope:

- Notification Center.
- Notification Settings.
- Notification list items.
- Notification category labels.
- Permission/device states.
- Nudge sender feedback.
- Saving reminder and nudge push templates.
- Client-side localized rendering from `event_key` and payload where possible.

Recommended Thai direction:

- `Notifications` -> `การแจ้งเตือน`.
- `Updates` -> `อัปเดต`.
- `Notification settings` -> `ตั้งค่าการแจ้งเตือน`.
- `Nudges` -> `สะกิด`.
- `Saving reminders` -> `เตือนเก็บเงิน`.
- `Partner activity` -> `ความเคลื่อนไหวของคู่ของคุณ`.
- `No notifications yet` -> `ยังไม่มีการแจ้งเตือน`.

Implementation note:

- Existing stored notification rows may remain English. Render localized known event types from `event_key` and `payload`; fall back to stored English for unknown/legacy rows.
- Push copy must use recipient language, so this phase should not happen before the language preference is persisted.

Do not:

- Redesign notification delivery.
- Change notification preference semantics.
- Add guilt or urgency to reminders.

### 24.6 Copy QA And Polish

Goal: make Thai feel complete, consistent, and robust on mobile.

Scope:

- Run a string audit for production routes.
- Check mixed-language states intentionally.
- Review Thai copy in real screen context.
- Verify mobile wrapping at 360px width.
- Verify date, amount, relative time, and count formatting.
- Verify empty/loading/error states.
- Review notification text length for push and in-app rows.
- Keep English copy working.

QA checklist:

- No raw keys.
- No awkward literal translations.
- No major mixed Thai/English in main flows unless intentional for names or brand terms.
- No layout breakage from longer Thai copy.
- No changes to money logic or database money tables.

## 7. UX/UI Language Switch Design

### Placement

Put language selection in Profile because it is a user-level preference, not a project setting.

Recommended MVP placement:

- Add a `Language` / `ภาษา` row near the top of Profile settings.
- Row meta shows the current choice: `ไทย` or `English`.
- Tapping opens a small modal or sheet with a segmented/two-row choice.

Do not place language in:

- Bottom navigation.
- Manage Project.
- Notification Settings.
- A first-run blocking modal.

### Display

Use native names:

- `ไทย`
- `English`

Recommended row labels:

- English UI: `Language`, description `Choose app language`, meta `English` or `ไทย`.
- Thai UI: `ภาษา`, description `เลือกภาษาของแอป`, meta `ไทย` or `English`.

Recommended modal title:

- English: `Language`
- Thai: `ภาษา`

### Loading Behavior

- Read localStorage synchronously before rendering the provider.
- Use localStorage language to avoid flashing English while profile loads.
- When profile loads with a different persisted value, update language and localStorage.
- On user selection, switch immediately and save in the background.
- If save fails, keep the local choice for this device and show a short non-blocking message.

### Fallback Behavior

- Missing Thai key falls back to English.
- Missing English key is a build-time problem if dictionary typing is used.
- Unknown language value falls back to `en`.
- User-generated names and project data stay as entered.
- Legacy notification rows can show stored English until known event rendering is implemented.

## 8. Acceptance Criteria

Task 24 is complete when:

- User can switch between Thai and English manually.
- Choice persists after reload.
- Signed-in user language can persist across devices if profile persistence is included.
- Main flows do not mix Thai and English unless intentional:
  - User names.
  - Project names.
  - Bucket names.
  - Brand name GO-OUT.
  - Legacy notification rows during migration.
- Amount formatting works in both languages.
- Date and relative-time formatting works in both languages.
- Dashboard, Add Money, Profile, Manage Project, Check Balance, Saving Plan, and Notifications have localized production copy.
- Thai copy follows the glossary and principles in this plan.
- Build passes.
- Lint passes.
- No money logic changes.
- No `savings_logs` changes.
- No bucket correction implementation.
- No unrelated refactor.

## 9. Risks

### Copy Length Breaking Mobile Layout

Thai can be compact, but some natural phrases are longer than English labels. Risk areas:

- Bottom nav labels.
- Dashboard cards.
- Saving Plan card.
- Notification list rows.
- Settings row descriptions.

Mitigation:

- Use short glossary terms.
- Test at 360px width.
- Prefer label plus helper text only where needed.
- Avoid uppercase/letter-spaced Thai styling where it harms readability.

### Mixed Language States

During phased rollout, converted and unconverted components may appear together.

Mitigation:

- Convert full user journeys, not random components.
- Use English fallback only as a temporary migration safety net.
- Track remaining production strings with `rg` before 24.6.

### Incomplete Translation

Strings exist in pages, components, helper modules, Edge Functions, SQL notification templates, and release notes.

Mitigation:

- Use a string inventory per phase.
- Defer preview pages deliberately.
- Keep notification legacy fallback explicit.

### Literal Translation Hurting UX

Terms like `Vault`, `Race`, `Bucket`, and `Nudge` can sound wrong when translated literally.

Mitigation:

- Follow the glossary.
- QA in real screen context.
- Prefer meaning and action over literal source text.

### Dynamic Grammar Issues

English pluralization and Thai sentence structure differ.

Mitigation:

- Use dictionary functions for dynamic strings.
- Pass formatted values into copy functions.
- Keep enum status labels centralized.

### Server And Client Copy Drift

Notifications can be stored in DB, rendered in the client, and sent as push payloads.

Mitigation:

- Centralize client notification copy by `event_key`.
- Keep server copy maps small and aligned with client terminology.
- Use stored notification title/body only as fallback for legacy or unknown events.

## 10. Recommended MVP Slice

The best MVP slice is:

1. 24.1 foundation and language setting.
2. Bottom navigation labels.
3. Profile language row/modal.
4. Dashboard top proof points:
   - Loading/fallback states.
   - Project header.
   - Recorded Vault.
   - Progress Race.
   - Saving Plan card headline statuses.

This proves the architecture, persistence, Thai typography, and mobile layout without touching money logic or the highest-risk server notification copy.

## 11. First Screens To Translate

Translate in this order:

1. Profile language setting, because users need to discover and change language.
2. Bottom navigation and common loading/error states, because they appear everywhere.
3. Dashboard, because it is the daily home screen and contains the key product terms.
4. Add Money, because it is the highest-frequency action.
5. Check Balance and Saving Plan, because terminology precision matters.
6. Notifications, because client/server copy needs extra care.

## 12. Should Claude Implement 24.1 First?

Yes. Claude should implement 24.1 first.

Reason:

- It creates the language switch, persistence, typed dictionary shape, and formatting helpers.
- It lets later phases replace copy safely without repeatedly inventing patterns.
- It avoids touching bucket correction, money logic, `savings_logs`, or notification delivery before the foundation is stable.

Do not start 24.2 or broader Thai copy replacement until 24.1 is working, build/lint pass, and the language switch behavior is accepted.
