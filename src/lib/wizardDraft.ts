export const WIZARD_DRAFT_KEY = 'go-out:wizard-draft';

// The create-room draft is intentionally session-scoped: it should survive
// step navigation and an accidental refresh within the same tab, but a fresh
// session must start from a clean wizard rather than restoring stale choices.
export function clearWizardDraft() {
  try { sessionStorage.removeItem(WIZARD_DRAFT_KEY); } catch { /* noop */ }
}
