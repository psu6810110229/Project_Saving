# Task: Redesign Saving Log UI Flow

## 1. Goal
Redesign the existing saving entry UI on the Battle page. Replace the current dual-form approach (`QuickLogBar` and `ManualLogForm` with dropdowns) with a single, visually appealing, production-ready flow that prioritizes User Experience (UX).

## 2. Requirements & New Flow

### 2.1 Bucket Selection (First Step)
- **Remove Dropdowns**: The `BucketSelector` dropdowns are no longer used for logging savings.
- **Bucket Grid**: Display all available buckets for the user as a grid or list of cards directly on the Battle page (replacing the old "Log composer" section).
- **Production Look**: Each bucket card must look premium, appropriately sized with clear hit areas, hover states, and smooth transitions. If the user has no buckets, display a clear, aesthetic prompt to create one.
- **Action**: Clicking on a bucket card initiates the log entry flow for that specific bucket.

### 2.2 Amount & Note Entry (Second Step - Modal)
- **Popup/Modal**: When a bucket card is clicked, open a centered modal.
- **Input Fields**: The modal must contain:
  - The name of the selected bucket.
  - Amount input (numeric).
  - Quick add presets (e.g., +฿100, +฿500, +฿1,000) for rapid entry.
  - Note input (optional text, max 140 chars).
- **Competitive Nudge Integration**: Display dynamic competitive information inside the modal to motivate the user.
  - Example: "Add ฿500 more to overtake Art!"
  - This requires calculating the gap between the current user's score and the next rank up using the existing leaderboard data.

### 2.3 UX & Layout Polish
- **Proper Placement**: The new Bucket Grid should fit naturally into the `BattlePage` layout, maintaining max-width constraints and appropriate spacing.
- **Sizing Matters**: Ensure inputs in the modal and cards on the screen are sized correctly for both mobile touch and desktop click.
- **Bug-Free Operations**: Handle edge cases smoothly (e.g., submitting empty amounts, loading states, error handling).
- **Responsive Animations**: Add subtle micro-interactions to buttons and modals.

## 3. Implementation Steps

1. **Create `LogAmountModal` Component**:
   - Create `src/components/LogAmountModal/LogAmountModal.tsx`.
   - Implement the modal UI containing amount, note, presets, and competitive text.
   - Compute the gap to the next player using the leaderboard state.
2. **Create `BucketGrid` Component**:
   - Create `src/components/BucketGrid/BucketGrid.tsx` to render the user's buckets as cards.
   - Wire up `onClick` events to open the modal with the selected bucket.
3. **Refactor `BattlePage.tsx`**:
   - Remove `QuickLogBar` and `ManualLogForm`.
   - Add state for managing the currently selected bucket (to trigger the modal).
   - Render the `BucketGrid` in the composer section.
   - Integrate the `LogAmountModal` and pass necessary props (submission handlers, leaderboard state).
4. **Cleanup**:
   - Safely deprecate or remove `QuickLogBar.tsx`, `ManualLogForm.tsx`, and integrate `BattleNudge.tsx` logic into the new flow.
