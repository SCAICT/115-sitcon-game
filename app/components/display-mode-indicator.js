"use client"

export default function DisplayModeIndicator() {
  return (
    <div className="fixed top-5 left-5 z-50 flex items-center gap-2 px-4 py-2 rounded-full bg-card/80 border border-border backdrop-blur-md">
      <span className="relative flex h-2.5 w-2.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[hsl(168,80%,50%)] opacity-75" />
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[hsl(168,80%,50%)]" />
      </span>
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Display Mode
      </span>
    </div>
  )
}
