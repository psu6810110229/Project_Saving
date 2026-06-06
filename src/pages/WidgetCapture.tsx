import { useEffect, useRef, useState } from 'react'
import type { WidgetSnapshot } from '../lib/widgetSnapshot'
import { SavingsWidget } from '../components/SavingsWidget/SavingsWidget'

declare global {
  interface Window {
    __WIDGET_SNAPSHOT__?: WidgetSnapshot
    // Native calls this after onPageFinished with the decoded snapshot object (or null).
    __renderWidget?: (snapshot: WidgetSnapshot | null, sizePath?: string) => void
    WIDGET_READY?: boolean
  }
}

type WidgetSize = '2x2' | '4x2' | 'team'

interface DomValidationResult {
  valid: boolean
  content: 'real' | 'empty' | 'missing'
  hasProject: boolean
  hasAmount: boolean
  hasProgress: boolean
  hasEmpty: boolean
  textLength: number
  rect: string
}

function getSize(): WidgetSize {
  const path = window.location.pathname
  if (path.includes('/team')) return 'team'
  if (path.includes('/small')) return '2x2'
  return '4x2'
}

function validateWidgetDom(): DomValidationResult {
  const root = document.querySelector<HTMLElement>('[data-widget-capture-root]')
  const content = root?.dataset.widgetContent === 'real'
    ? 'real'
    : root?.dataset.widgetContent === 'empty'
      ? 'empty'
      : 'missing'
  const host = root ?? document.body
  const rect = root?.getBoundingClientRect()
  const hasVisibleBox = rect != null && rect.width > 0 && rect.height > 0
  const hasProject = !!host.querySelector('[data-widget-project]')
  const hasAmount = !!host.querySelector('[data-widget-amount]')
  const hasProgress = !!host.querySelector('[data-widget-progress]')
  const hasEmpty = !!host.querySelector('[data-widget-empty]')
  const textLength = (host.textContent ?? '').trim().length
  const valid = hasVisibleBox && (
    (content === 'real' && hasProject && (hasAmount || hasProgress) && textLength > 0)
    || (content === 'empty' && hasEmpty && textLength > 0)
  )

  return {
    valid,
    content,
    hasProject,
    hasAmount,
    hasProgress,
    hasEmpty,
    textLength,
    rect: rect ? `${Math.round(rect.width)}x${Math.round(rect.height)}` : 'none',
  }
}

// ─── Module-level injection bridge ────────────────────────────────────────────
// Set up before React renders so the function is available immediately when
// native calls it in onPageFinished (which fires after module evaluation).

let _setSnapshotFromNative: ((s: WidgetSnapshot | null) => void) | null = null
// Buffer if native calls __renderWidget before the component's useEffect fires.
let _pendingInject: { snapshot: WidgetSnapshot | null } | null = null

window.__renderWidget = (snapshot, sizePath) => {
  console.log('[Widget] __renderWidget called, data:', snapshot != null, 'size:', sizePath ?? getSize())
  if (_setSnapshotFromNative) {
    _setSnapshotFromNative(snapshot)
  } else {
    _pendingInject = { snapshot }
  }
}

// ──────────────────────────────────────────────────────────────────────────────

export function WidgetCapture() {
  const size = getSize()

  const [snapshot, setSnapshot] = useState<WidgetSnapshot | null>(() => {
    // Pick up snapshot if native injected it before the component mounted.
    if (window.__WIDGET_SNAPSHOT__ != null) return window.__WIDGET_SNAPSHOT__
    if (_pendingInject != null) {
      const pending = _pendingInject.snapshot
      _pendingInject = null
      return pending
    }
    return null
  })

  // Stable ref for reading latest snapshot inside async effects without
  // creating new effect deps. Written inside effects only (not during render).
  const snapshotRef = useRef<WidgetSnapshot | null>(null)

  useEffect(() => {
    console.log('[Widget] route loaded, size:', size)
    console.log('[Widget] WidgetCapture mounted')
  }, [size])

  // Wire up the native bridge setter once on mount.
  useEffect(() => {
    let pendingTimeoutId: number | null = null

    if (_pendingInject != null) {
      const pending = _pendingInject.snapshot
      _pendingInject = null
      pendingTimeoutId = window.setTimeout(() => {
        console.log('[Widget] snapshot injected from buffer:', pending != null)
        setSnapshot(pending)
      }, 0)
    }
    _setSnapshotFromNative = (nextSnapshot) => {
      console.log('[Widget] snapshot injected:', nextSnapshot != null)
      setSnapshot(nextSnapshot)
    }
    return () => {
      if (pendingTimeoutId != null) window.clearTimeout(pendingTimeoutId)
      _setSnapshotFromNative = null
    }
  }, [setSnapshot])

  // Signal widget readiness after snapshot, fonts, and layout settle.
  useEffect(() => {
    snapshotRef.current = snapshot // safe: written inside effect, not during render
    const controller = new AbortController()

    void (async () => {
      // If no snapshot yet, wait briefly in case native injects shortly after load.
      if (snapshotRef.current == null) {
        await new Promise(r => setTimeout(r, 300))
        if (controller.signal.aborted) return
      }

      await document.fonts.ready
      if (controller.signal.aborted) return
      console.log('[Widget] fonts ready')

      // Wait for images (team avatars are remote), but race each pending image
      // against a short timeout so one slow/stalled avatar can't burn the whole
      // capture window — the affected member just renders its initial fallback.
      const imgs = Array.from(document.images)
      await Promise.all(
        imgs.filter(img => !img.complete).map(
          img => new Promise<void>(resolve => {
            const done = () => resolve()
            img.onload = done
            img.onerror = done
            setTimeout(done, 2500)
          })
        )
      )
      if (controller.signal.aborted) return
      console.log('[Widget] images ready (', imgs.length, ')')

      // Two rAFs for layout to settle after React paint.
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
      if (controller.signal.aborted) return

      const validation = validateWidgetDom()
      console.log('[Widget] DOM validation result:', JSON.stringify(validation))

      const state = validation.valid
        ? (snapshotRef.current != null ? 'true' : 'empty')
        : 'invalid'
      document.documentElement.setAttribute('data-widget-ready', state)
      window.WIDGET_READY = true
      console.log('[Widget] data-widget-ready:', state)
    })()

    return () => controller.abort()
  }, [snapshot])

  if (snapshot == null) {
    return (
      <div
        data-widget-capture-root
        data-widget-content="empty"
        className="flex h-full w-full items-center justify-center rounded-[28px] bg-gradient-to-br from-[#FBF1E7] via-[#F7EBDD] to-[#EFDCC8]"
        style={{ margin: 0, padding: 0 }}
      >
        <div className="text-center" data-widget-empty="true">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-ink-muted">
            GO-OUT
          </p>
          <p className="mt-1 font-mono text-[10px] text-ink-dim">เปิดแอปเพื่ออัปเดต</p>
        </div>
      </div>
    )
  }

  return (
    <div
      data-widget-capture-root
      data-widget-content="real"
      className="flex h-full w-full items-center justify-center"
      style={{ margin: 0, padding: 0 }}
    >
      <SavingsWidget size={size} fluid {...snapshot} />
    </div>
  )
}
