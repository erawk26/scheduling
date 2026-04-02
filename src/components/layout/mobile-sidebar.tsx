import { Link, useLocation } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
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

interface MobileSidebarProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MobileSidebar({ open, onOpenChange }: MobileSidebarProps) {
  const { pathname } = useLocation()
  const { isOnline } = useNetworkStatus()

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-64 p-0 flex flex-col">
        <SheetHeader className="px-6 py-5 border-b border-border">
          <SheetTitle className="flex items-center gap-3">
            <Calendar className="w-8 h-8 text-fern" />
            <span className="text-xl font-display font-semibold text-foreground">KE Agenda</span>
          </SheetTitle>
        </SheetHeader>
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
                onClick={() => onOpenChange(false)}
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
        <div className="border-t border-border px-3 py-3 mt-auto">
          <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
            <span className={cn('h-2 w-2 rounded-full flex-shrink-0', isOnline ? 'bg-green-500' : 'bg-amber-500')} />
            {isOnline ? 'Online' : 'Offline'}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
