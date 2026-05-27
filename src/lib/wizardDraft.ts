export const WIZARD_DRAFT_KEY = 'go-out:wizard-draft';

export function clearWizardDraft() {
  try { localStorage.removeItem(WIZARD_DRAFT_KEY); } catch { /* noop */ }
}
