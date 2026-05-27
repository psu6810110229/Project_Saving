const JOIN_WIZARD_DRAFT_KEY = 'go-out:join-wizard-draft';

export function joinWizardDraftKey(roomId: string): string {
  return `${JOIN_WIZARD_DRAFT_KEY}:${roomId}`;
}

export function clearJoinWizardDraft(roomId: string) {
  try {
    localStorage.removeItem(joinWizardDraftKey(roomId));
  } catch {
    // Best effort cleanup only.
  }
}
