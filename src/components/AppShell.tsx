import type { ReactNode } from "react";

interface AppShellProps {
  sidebar: ReactNode;
  children: ReactNode;
  rightPanel?: ReactNode;
}

export default function AppShell({ sidebar, children, rightPanel }: AppShellProps) {
  return (
    <div className="flex h-screen bg-[#f5f7ff] text-ink">
      <aside className="hidden h-full shrink-0 md:flex">{sidebar}</aside>
      <div className="flex flex-1 overflow-hidden">
        <main className="h-full flex-1 overflow-y-auto px-4 py-4">
          <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-6">
            {children}
          </div>
        </main>
        {rightPanel ? (
          <aside className="hidden h-full w-[360px] shrink-0 rounded-[28px] bg-white/70 px-6 py-6 xl:block">
            {rightPanel}
          </aside>
        ) : null}
      </div>
    </div>
  );
}
