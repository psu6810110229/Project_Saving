# Performance Verification Checklist

## Manual Device Test Checklist

Test on:

- Older iPhone if available.
- Low-end or midrange Android device.
- Upper-midrange Android device as a control.
- iPhone 11+ as a control.
- Desktop browser only as a sanity check, not as the main acceptance target.

Viewports:

- 320 x 700.
- 375 x 812.
- 390 x 844.
- Real device viewport.

Routes and flows:

- App launch and splash exit.
- Dashboard route entry.
- Dashboard scroll top to bottom and back.
- Team route entry.
- Team member menu open and close.
- Team member detail modal open and close.
- Team chart mode switch: Room, Me, Compare.
- Purpose picker changes.
- Bucket sheet open and close.
- Bucket deposit confirm success flow.
- Bucket transfer sheet open, review, success, close.
- Check balance sheet open and close.
- Pull-to-refresh on Dashboard.
- Pull-to-refresh on Team.
- Bucket drag to transfer.
- Bucket edit mode reorder.
- Completed bucket expand/collapse.
- Heatmap horizontal scroll and popover.
- Notifications page and notification settings.
- Profile page.
- Create/join room wizard surfaces if relevant.

Manual notes to capture:

- Did route transition visibly stutter?
- Did scroll feel sticky or delayed?
- Did sheet open freeze the page behind it?
- Did chart mode switch hitch?
- Did touch gestures feel delayed?
- Did DnD lag behind the finger?
- Did any animation feel missing or visually downgraded?
- Did any copy, spacing, or layout shift?

## Chrome DevTools / Performance Trace Checklist

Use consistent conditions:

- Same build mode.
- Same route.
- Same logged-in account.
- Same viewport.
- Same data state where possible.
- Wait for initial loading to settle.
- Run each trace twice if noisy.

Trace scenarios:

- Dashboard route entry.
- Dashboard scroll.
- Team route entry.
- Team chart mode switch.
- Bucket sheet open/close.
- Pull-to-refresh.
- Bucket drag.
- Heatmap scroll.

Metrics to record:

- Average FPS or visible FPS range.
- Worst frame time.
- Dropped frames.
- Long task count.
- Total scripting time.
- Total rendering/layout time.
- Total painting/raster time.
- React commit count if React profiling is used.
- GPU raster spikes if visible.
- Screenshots or short visual notes.

Pass signals:

- Fewer long tasks.
- Lower scripting time during touch/scroll.
- Lower paint/raster spikes during visual islands.
- Fewer dropped frames during route and sheet transitions.
- No visual regression.

Fail signals:

- Total scripting, rendering, or painting time gets worse by 10% or more without a visible improvement.
- Route transition looks different.
- Visual effects look flatter or downgraded.
- A product flow changes.
- Reduced-motion behavior regresses.

## Capacitor Android WebView Checklist

Test in the Capacitor Android build when practical because WebView performance can differ from desktop Chrome.

Checklist:

- Build the app in the same mode used for release testing.
- Install on at least one weaker Android device.
- Test Dashboard route entry and scroll.
- Test Team route entry and chart mode switch.
- Test pull-to-refresh.
- Test bucket drag.
- Test bucket sheet open/close.
- Test app resume after backgrounding.
- Test soft keyboard behavior in sheets/forms.
- Confirm haptics still feel correct.
- Confirm Android widget behavior was not touched.

Watch for:

- WebView-specific frame drops.
- Touch input delay.
- Back button behavior.
- Safe-area and bottom nav layout.
- Keyboard pushing or resizing sheet content.

## Before/After Comparison Checklist

For each phase, record:

- Phase name.
- Files changed in that implementation phase.
- Device/browser/WebView.
- Build mode.
- Viewport.
- Scenario.
- Before metrics.
- After metrics.
- Percent change.
- Visual regression notes.
- Product behavior notes.
- Decision: keep, adjust, or rollback.

Suggested table:

| Scenario | Before | After | Change | Pass/Fail | Notes |
| --- | ---: | ---: | ---: | --- | --- |
| Dashboard route worst frame | TBD | TBD | TBD | TBD | TBD |
| Dashboard scroll dropped frames | TBD | TBD | TBD | TBD | TBD |
| Team route worst frame | TBD | TBD | TBD | TBD | TBD |
| Chart switch scripting time | TBD | TBD | TBD | TBD | TBD |
| Sheet open long tasks | TBD | TBD | TBD | TBD | TBD |
| Pull gesture scripting time | TBD | TBD | TBD | TBD | TBD |
| Drag worst frame | TBD | TBD | TBD | TBD | TBD |

Improvement formula for lower-is-better metrics:

```text
improvement_percent = ((before - after) / before) * 100
```

FPS gain formula:

```text
fps_gain_percent = ((after - before) / before) * 100
```

## Visual Regression Checklist

Confirm unchanged:

- Warm GO-OUT palette.
- Cream/terracotta/cocoa visual identity.
- Neumorphic surfaces.
- Glass and blur quality.
- Shadows and glow strength.
- Hero cover image treatment.
- Hero feather blur.
- Hero scrim readability.
- Card depth and rounded corners.
- Route transition direction, timing, and feel.
- Sheet spring feel.
- Modal/backdrop appearance.
- Chart colors, labels, markers, popovers, and empty states.
- Progress bar and ring visual quality.
- Team podium/rings/glass look.
- Heatmap cell colors, markers, labels, and popovers.
- Bottom nav layout and active states.
- Thai text rendering and fitting.
- English text fitting.
- Reduced-motion behavior.

Confirm unchanged product behavior:

- Deposits.
- Bucket opening.
- Bucket transfer.
- Bucket reorder.
- Reconcile/check balance.
- Notifications.
- Nudges.
- Profile edits.
- Create/join room.
- Android widget.
- Haptics.
- Navigation and back behavior.

## Rollback Checklist

Before merging any implementation phase:

- Each change should be isolated enough to revert independently.
- No backend migrations or environment changes should exist.
- No product behavior should be mixed with performance changes.
- No visual simplification should be hidden inside performance work.
- Keep implementation commits phase-scoped when possible.

