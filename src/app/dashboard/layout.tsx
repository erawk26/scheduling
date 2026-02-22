'use client'

import { useState } from 'react'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { MobileSidebar } from '@/components/layout/mobile-sidebar'
import { useInitialDataPull } from '@/hooks/use-initial-data-pull'

function InitialPullBanner() {
  const { isPulling, progress } = useInitialDataPull();

  if (!isPulling) return null;

  return (
    <div className="bg-blue-50 border-b border-blue-200 px-4 py-3 text-sm text-blue-700 flex items-center gap-2">
      <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      <span>{progress || 'Syncing your data...'}</span>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <MobileSidebar
          open={isMobileMenuOpen}
          onOpenChange={setIsMobileMenuOpen}
        />
        <div className="flex flex-col flex-1 overflow-hidden">
          <Header onMenuClick={() => setIsMobileMenuOpen(true)} />
          <InitialPullBanner />
          <main className="flex-1 overflow-y-auto">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
