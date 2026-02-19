'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Menu, Bell, Wifi, WifiOff } from 'lucide-react'
import { useAuth } from '@/providers/auth-provider'

interface HeaderProps {
  onMenuClick?: () => void
}

export function Header({ onMenuClick }: HeaderProps) {
  const { session } = useAuth()
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    setIsOnline(navigator.onLine)
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const userName = session?.user?.name || 'User'
  const userInitial = userName.charAt(0).toUpperCase()

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
        {/* Mobile menu button */}
        <Button
          variant="ghost"
          size="sm"
          className="md:hidden"
          onClick={onMenuClick}
        >
          <Menu className="h-6 w-6" />
        </Button>

        {/* Logo for mobile */}
        <div className="flex items-center md:hidden">
          <span className="text-lg font-bold text-gray-900">KE Agenda</span>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-4 ml-auto">
          {/* Online/Offline Status */}
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
              isOnline
                ? 'bg-green-100 text-green-700'
                : 'bg-amber-100 text-amber-700'
            }`}
          >
            {isOnline ? (
              <Wifi className="h-4 w-4" />
            ) : (
              <WifiOff className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>

          {/* Notifications */}
          <Button variant="ghost" size="sm" className="relative">
            <Bell className="h-5 w-5" />
            <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full" />
          </Button>

          {/* User menu */}
          <Button variant="ghost" size="sm" className="gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
              <span className="text-sm font-semibold text-white">{userInitial}</span>
            </div>
            <span className="hidden sm:inline text-sm font-medium">
              {userName}
            </span>
          </Button>
        </div>
      </div>
    </header>
  )
}
