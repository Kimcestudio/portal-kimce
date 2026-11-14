'use client'
import { HubProvider } from '@/cmhub/context'
import { HubThemeProvider } from '@/cmhub/theme'
import ImportOverlay from '@/components/cmhub/ImportOverlay'
import HubSidebar from '@/components/cmhub/HubSidebar'
import HubLayoutShell from '@/components/cmhub/HubLayoutShell'
import OverdueCheckerMount from '@/components/cmhub/OverdueCheckerMount'
import PresenceMount from '@/components/cmhub/PresenceMount'

export default function ContenidosLayout({ children }: { children: React.ReactNode }) {
  return (
    <HubProvider>
      <HubThemeProvider>
        <ImportOverlay />
        <OverdueCheckerMount />
        <PresenceMount />
        <HubLayoutShell>
          <HubSidebar />
          <main className="flex-1 overflow-hidden h-full">
            {children}
          </main>
        </HubLayoutShell>
      </HubThemeProvider>
    </HubProvider>
  )
}
