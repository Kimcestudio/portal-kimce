import type { ReactNode } from "react";

interface AppShellProps {
  sidebar: ReactNode;
  children: ReactNode;
  rightPanel?: ReactNode;
}

export default function AppShell({ sidebar, children, rightPanel }: AppShellProps) {
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <div className="flex min-h-screen">
        <aside className="hidden md:flex w-[92px] shrink-0 px-4 py-6">
          {sidebar}
        </aside>
        <main className="flex-1 px-6 py-8 md:px-8 lg:px-10">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
            {children}
          </div>
        </main>
        {rightPanel ? (
          <aside className="hidden xl:block w-[360px] shrink-0 bg-white/70 px-6 py-8">
            {rightPanel}
          </aside>
        ) : null}
      </div>
    </div>
  );
}
