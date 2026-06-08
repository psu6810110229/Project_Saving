# GO-OUT Performance Optimization Plan

## Executive Summary

GO-OUT is already built with a careful mobile-first visual system: warm cream and terracotta tokens, soft neumorphic depth, glass surfaces, hero-image cards, Framer Motion transitions, SVG charts, tactile press feedback, haptics, PWA behavior, and Capacitor mobile packaging.

The current performance issue is not one single bad animation. The likely cause is animation overlap: route transitions, Dashboard entrance stagger, animated numbers, progress bars, charts, sheets, pull-to-refresh, DnD measuring, glass/blur/shadow layers, SVG ring effects, and scroll updates can compete for the same mobile frame budget. Upper-midrange phones absorb that cost. Weaker Android devices and older iPhones expose the missed frames.

This plan improves smoothness by changing the rendering path, scheduling, batching, containment, and measurement discipline while preserving the same visual quality, motion feel, blur, shadow, glass, neumorphic style, transitions, timing, UI copy, and product behavior.

## Goals

- Improve animation smoothness on weaker mobile devices.
- Reduce dropped frames during route transitions, sheet opens, chart changes, pull-to-refresh, Dashboard scroll, Team page entry, and bucket drag interactions.
- Preserve existing visual quality and motion language.
- Avoid removing or downgrading effects.
- Avoid product behavior changes.
- Keep work phased, measurable, reversible, and low-risk first.
- Prefer rendering-path optimization over visual simplification.
- Prefer transform and opacity over layout animation where visually identical.
- Prefer requestAnimationFrame batching for touch and scroll state.
- Prefer memoization only where it prevents real unnecessary renders.
- Prefer containment and isolation only where layout and visual output remain unchanged.

## Non-Goals

- No UI redesign.
- No visual simplification.
- No removal of animations.
- No downgrade of blur, shadow, glass, gradients, neumorphic effects, transitions, or motion timing.
- No new libraries.
- No backend work.
- No data model changes.
- No routing architecture changes unless later phases prove it is unavoidable.
- No performance changes that alter money, savings, buckets, transfers, reconcile, notifications, language, haptics, widgets, or product flows.

## Strict No-Touch List

Do not touch:

- Supabase logic, RLS, migrations, Edge Functions, API contracts, auth, database logic, routes, or environment variables.
- Money logic.
- Saving calculations.
- Bucket and transfer semantics.
- Reconcile behavior.
- Notifications behavior.
- i18n copy.
- Thai font behavior.
- Haptics behavior.
- Navigation behavior.
- Android widget behavior.
- Product flows.
- Backend files.
- Visual identity tokens except where a phase explicitly calls for non-visual rendering-path support.
- The perceived quality of blur, shadow, glass, gradients, card depth, transitions, timing, or motion feel.

## Phase Overview

| Phase | Focus | Risk | Purpose |
| --- | --- | --- | --- |
| Phase 1 | Safe fixes | Low | Smooth obvious touch/scroll/render hot paths without changing visuals or product behavior. |
| Phase 2 | Motion scheduling | Low to medium | Prevent too many animations from starting in the same frame window. |
| Phase 3 | Heavy visual islands | Medium | Isolate expensive hero, chart, Team, heatmap, sheet, blur, shadow, and glass regions without reducing quality. |
| Phase 4 | Advanced risky fixes | High | Deferred architecture work for DnD, charts, Framer Motion, virtualization, and route transitions only if Phases 1-3 are insufficient. |

Recommended order:

1. Phase 1: safe fixes and trace discipline.
2. Phase 2: animation budget and scheduling.
3. Phase 3: heavy visual island containment.
4. Phase 4: risky/deferred architecture changes only after measured evidence.

## Verification Strategy

Use the same route, data state, viewport, browser/WebView, and account state before and after each phase.

Primary scenarios:

- Dashboard route entry.
- Dashboard scroll top to bottom and back.
- Team route entry.
- Team chart mode switch: Room, Me, Compare.
- Bucket sheet open and close.
- Bucket transfer sheet open and close.
- Pull-to-refresh gesture.
- Bucket drag and reorder.
- Heatmap horizontal scroll and popover.

Primary viewports:

- 320 x 700.
- 375 x 812.
- 390 x 844.
- Real Android WebView where possible.

Metrics:

- Dropped frames.
- Worst frame time.
- Long tasks.
- Total scripting time.
- Rendering and layout time.
- Paint and raster time.
- React commit count where available.
- Visible stutter notes.

Trace rules:

- Do not compare dev-server traces against production-build traces.
- Do not compare logged-out states against logged-in Dashboard states.
- Wait for initial data loading to settle before recording.
- Capture reduced-motion separately from normal-motion.
- Keep screenshots or short videos for visual regression checks.

