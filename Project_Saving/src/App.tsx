function App() {
  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-6">
      <div className="bg-surface rounded-xl shadow-soft p-8 flex flex-col gap-4 w-full max-w-sm border border-border">
        <h1 className="text-2xl text-ink font-sans">Project Saving</h1>
        <p className="text-ink-muted text-sm">Gamified savings battle — Fan vs Art</p>
        <button className="bg-terracotta text-white rounded-lg px-4 py-2 text-sm font-medium">
          Get started
        </button>
        <span className="text-xs text-ink-dim">Design system: Minimal Terracotta</span>
      </div>
    </div>
  )
}

export default App
