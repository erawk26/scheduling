'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Calendar, Users, Briefcase, CloudSun, Settings, LayoutDashboard, Lightbulb, Bot } from 'lucide-react'
import { useNetworkStatus } from '@/hooks/use-network-status'
// TODO: useSync disabled — mpb-localkit/react incompatible with Turbopack dev (offlinekit#13)
// import { useSync } from 'mpb-localkit/react'
// import { app } from '@/lib/offlinekit'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Appointments', href: '/dashboard/appointments', icon: Calendar },
  { name: 'Clients', href: '/dashboard/clients', icon: Users },
  { name: 'Services', href: '/dashboard/services', icon: Briefcase },
  { name: 'Weather', href: '/dashboard/weather', icon: CloudSun },
  { name: 'Smart Schedule', href: '/dashboard/schedule-intelligence', icon: Lightbulb },
  { name: 'Chat', href: '/dashboard/chat', icon: Bot },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const { isOnline } = useNetworkStatus()
  const statusLabel = isOnline ? 'Online' : 'Offline'

  return (
    <aside className="hidden md:flex md:flex-shrink-0">
      <div className="flex flex-col w-64">
        <div className="flex flex-col flex-grow border-r border-gray-200 bg-white overflow-y-auto">
          <div className="flex items-center flex-shrink-0 px-6 py-5 border-b border-gray-200">
            <Calendar className="w-8 h-8 text-primary" />
            <span className="ml-3 text-xl font-bold text-gray-900">KE Agenda</span>
          </div>
          <nav className="flex-1 px-3 py-4 space-y-1">
            {navigation.map((item) => {
              const isActive = item.href === '/dashboard'
                ? pathname === '/dashboard'
                : pathname.startsWith(item.href)
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors',
                    isActive
                      ? 'bg-primary text-white'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  )}
                >
                  <item.icon
                    className={cn(
                      'mr-3 h-5 w-5 flex-shrink-0',
                      isActive ? 'text-white' : 'text-gray-400 group-hover:text-gray-500'
                    )}
                  />
                  {item.name}
                </Link>
              )
            })}
          </nav>
          <div className="flex-shrink-0 border-t border-gray-200 px-3 py-3">
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-gray-500">
              <span className={cn('h-2 w-2 rounded-full flex-shrink-0', isOnline ? 'bg-green-500' : 'bg-amber-500')} />
              {statusLabel}
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}
