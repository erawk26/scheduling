import { Link, useLocation } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { Calendar, Users, Briefcase, CloudSun, Settings, LayoutDashboard, Bot, UserCog, CreditCard } from 'lucide-react'
import { useNetworkStatus } from '@/hooks/use-network-status'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Appointments', href: '/dashboard/appointments', icon: Calendar },
  { name: 'Clients', href: '/dashboard/clients', icon: Users },
  { name: 'Services', href: '/dashboard/services', icon: Briefcase },
  { name: 'Weather', href: '/dashboard/weather', icon: CloudSun },
  { name: 'Chat', href: '/dashboard/chat', icon: Bot },
  { name: 'Agent Profile', href: '/dashboard/settings/profile', icon: UserCog },
  { name: 'Billing', href: '/dashboard/settings/billing', icon: CreditCard },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
]

export function Sidebar() {
  const { pathname } = useLocation()
  const { isOnline } = useNetworkStatus()
  const statusLabel = isOnline ? 'Online' : 'Offline'

  return (
    <aside className="hidden md:flex md:flex-shrink-0">
      <div className="flex flex-col w-64">
        <div className="flex flex-col flex-grow border-r border-border bg-card overflow-y-auto">
          <div className="flex items-center flex-shrink-0 px-6 py-5 border-b border-border">
            <Calendar className="w-8 h-8 text-fern" />
            <span className="ml-3 text-xl font-display font-semibold text-foreground">KE Agenda</span>
          </div>
          <nav className="flex-1 px-3 py-4 space-y-1">
            {navigation.map((item) => {
              const isActive = item.href === '/dashboard'
                ? pathname === '/dashboard'
                : item.href === '/dashboard/settings'
                  ? pathname === '/dashboard/settings'
                  : pathname.startsWith(item.href)
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={cn(
                    'group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-secondary-foreground hover:bg-fern-pale hover:text-foreground'
                  )}
                >
                  <item.icon
                    className={cn(
                      'mr-3 h-5 w-5 flex-shrink-0',
                      isActive ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-foreground'
                    )}
                  />
                  {item.name}
                </Link>
              )
            })}
          </nav>
          <div className="flex-shrink-0 border-t border-border px-3 py-3">
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
              <span className={cn('h-2 w-2 rounded-full flex-shrink-0', isOnline ? 'bg-success' : 'bg-warning')} />
              {statusLabel}
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}
