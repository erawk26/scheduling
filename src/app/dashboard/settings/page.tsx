'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/providers/auth-provider'
import { useDatabase, useSyncStatus } from '@/providers/database-provider'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { User, Building, Shield, LogOut, Database, Trash2 } from 'lucide-react'
import { useSeedMockData, useCleanupMockData } from '@/hooks/use-mock-data'

const US_TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Phoenix', label: 'Arizona (MST)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HST)' },
]

export default function SettingsPage() {
  const { session, signOut } = useAuth()
  const { db, isReady } = useDatabase()
  const syncStatus = useSyncStatus()

  // Business settings form state
  const [businessName, setBusinessName] = useState('')
  const [phone, setPhone] = useState('')
  const [timezone, setTimezone] = useState('America/New_York')
  const [serviceAreaMiles, setServiceAreaMiles] = useState(25)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')

  const seedMockData = useSeedMockData()
  const cleanupMockData = useCleanupMockData()
  const [seedMessage, setSeedMessage] = useState('')

  // Get userId from session or use fallback
  const userId = session?.user?.id || 'local-user'

  // Load user data on mount
  useEffect(() => {
    async function loadUserData() {
      if (!db || !isReady) return

      try {
        const result = await db
          .selectFrom('users')
          .selectAll()
          .where('id', '=', userId)
          .executeTakeFirst()

        if (result) {
          setBusinessName(result.business_name || '')
          setPhone(result.phone || '')
          setTimezone(result.timezone || 'America/New_York')
          setServiceAreaMiles(result.service_area_miles || 25)
        }
      } catch (error) {
        console.error('Failed to load user data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadUserData()
  }, [db, isReady, userId])

  // Save business settings
  const handleSaveBusinessSettings = async () => {
    if (!db) {
      setSaveMessage('Database not ready')
      return
    }

    setIsSaving(true)
    setSaveMessage('')

    try {
      const now = new Date().toISOString()

      // Check if user row exists
      const existingUser = await db
        .selectFrom('users')
        .select('id')
        .where('id', '=', userId)
        .executeTakeFirst()

      if (existingUser) {
        await db
          .updateTable('users')
          .set({
            business_name: businessName,
            phone: phone,
            timezone: timezone,
            service_area_miles: serviceAreaMiles,
            updated_at: now,
            needs_sync: 1,
            sync_operation: 'UPDATE',
          })
          .where('id', '=', userId)
          .execute()
      } else {
        await db
          .insertInto('users')
          .values({
            id: userId,
            business_name: businessName,
            phone: phone,
            timezone: timezone,
            service_area_miles: serviceAreaMiles,
            created_at: now,
            updated_at: now,
            version: 1,
            needs_sync: 1,
            sync_operation: 'INSERT',
            synced_at: null,
          })
          .execute()
      }

      setSaveMessage('Settings saved successfully!')
      setTimeout(() => setSaveMessage(''), 3000)
    } catch (error) {
      console.error('Failed to save settings:', error)
      setSaveMessage('Failed to save settings. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  // Handle sign out
  const handleSignOut = async () => {
    try {
      await signOut()
    } catch (error) {
      console.error('Sign out error:', error)
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="mt-2 text-gray-600">
          Manage your account and application preferences
        </p>
      </div>

      {/* Settings Tabs */}
      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList>
          <TabsTrigger value="profile">
            <User className="w-4 h-4 mr-2" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="business">
            <Building className="w-4 h-4 mr-2" />
            Business
          </TabsTrigger>
          <TabsTrigger value="account">
            <Shield className="w-4 h-4 mr-2" />
            Account
          </TabsTrigger>
          <TabsTrigger value="devtools">
            <Database className="w-4 h-4 mr-2" />
            Dev Tools
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>
                Your authentication details from Better Auth
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* User Avatar Placeholder */}
              <div className="flex items-center space-x-4">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-2xl font-semibold">
                  {session?.user?.name?.charAt(0).toUpperCase() || session?.user?.email?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Profile Picture</p>
                  <p className="text-xs text-gray-500 mt-1">Avatar placeholder</p>
                </div>
              </div>

              <Separator />

              {/* Read-only auth info */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={session?.user?.name || 'Not set'}
                    readOnly
                    disabled
                    className="bg-gray-50"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    value={session?.user?.email || 'Not authenticated'}
                    readOnly
                    disabled
                    className="bg-gray-50"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Email Verified</Label>
                  <Input
                    value={session?.user?.emailVerified ? 'Yes' : 'No'}
                    readOnly
                    disabled
                    className="bg-gray-50"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Account Created</Label>
                  <Input
                    value={session?.user?.createdAt ? new Date(session.user.createdAt).toLocaleDateString() : 'N/A'}
                    readOnly
                    disabled
                    className="bg-gray-50"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Business Tab */}
        <TabsContent value="business" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Business Settings</CardTitle>
              <CardDescription>
                Configure your business information stored in local SQLite
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {isLoading ? (
                <div className="text-center py-8 text-gray-500">Loading settings...</div>
              ) : (
                <>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="businessName">Business Name</Label>
                      <Input
                        id="businessName"
                        autoComplete="organization"
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        placeholder="Enter your business name"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input
                        id="phone"
                        type="tel"
                        autoComplete="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="(555) 123-4567"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="timezone">Timezone</Label>
                      <Select value={timezone} onValueChange={setTimezone}>
                        <SelectTrigger id="timezone">
                          <SelectValue placeholder="Select timezone" />
                        </SelectTrigger>
                        <SelectContent>
                          {US_TIMEZONES.map((tz) => (
                            <SelectItem key={tz.value} value={tz.value}>
                              {tz.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="serviceAreaMiles">Service Area (miles)</Label>
                      <Input
                        id="serviceAreaMiles"
                        type="number"
                        min="1"
                        max="500"
                        value={serviceAreaMiles}
                        onChange={(e) => setServiceAreaMiles(Number(e.target.value))}
                      />
                      <p className="text-xs text-gray-500">
                        Maximum distance you will travel for appointments
                      </p>
                    </div>
                  </div>

                  <Separator />

                  {/* Save Button */}
                  <div className="space-y-2">
                    <Button
                      onClick={handleSaveBusinessSettings}
                      disabled={isSaving}
                      className="w-full"
                    >
                      {isSaving ? 'Saving...' : 'Save Business Settings'}
                    </Button>

                    {saveMessage && (
                      <p
                        className={`text-sm text-center ${
                          saveMessage.includes('success')
                            ? 'text-green-600'
                            : 'text-red-600'
                        }`}
                      >
                        {saveMessage}
                      </p>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Account Tab */}
        <TabsContent value="account" className="space-y-4">
          {/* Sign Out Section */}
          <Card>
            <CardHeader>
              <CardTitle>Session Management</CardTitle>
              <CardDescription>Sign out of your account</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                onClick={handleSignOut}
                className="w-full"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </CardContent>
          </Card>

          {/* Sync Status */}
          <Card>
            <CardHeader>
              <CardTitle>Sync Status</CardTitle>
              <CardDescription>Current synchronization state</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Status</span>
                <span className={`text-sm font-medium ${syncStatus?.is_syncing ? 'text-blue-600' : 'text-green-600'}`}>
                  {syncStatus?.is_syncing ? 'Syncing...' : 'Ready'}
                </span>
              </div>

              <Separator />

              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Pending Items</span>
                <span className="text-sm font-medium text-gray-900">
                  {syncStatus?.pending_items ?? 0}
                </span>
              </div>

              <Separator />

              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Last Sync</span>
                <span className="text-sm font-medium text-gray-900">
                  {syncStatus?.last_sync
                    ? new Date(syncStatus.last_sync).toLocaleString()
                    : 'Never'}
                </span>
              </div>

              {syncStatus?.last_error && (
                <>
                  <Separator />
                  <div className="space-y-1">
                    <span className="text-sm text-gray-600">Last Error</span>
                    <p className="text-xs text-red-600">{syncStatus.last_error}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* App Version */}
          <Card>
            <CardHeader>
              <CardTitle>Application Info</CardTitle>
              <CardDescription>Version and build information</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">App Version</span>
                  <span className="text-sm font-medium text-gray-900">3.0.0</span>
                </div>

                <Separator />

                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Build</span>
                  <span className="text-sm font-medium text-gray-900">Foundation</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="text-red-600">Danger Zone</CardTitle>
              <CardDescription>Irreversible and destructive actions</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="destructive"
                disabled
                className="w-full"
              >
                Delete Account
              </Button>
              <p className="text-xs text-gray-500 mt-2 text-center">
                Account deletion is not yet implemented
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Dev Tools Tab */}
        <TabsContent value="devtools" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Mock Data</CardTitle>
              <CardDescription>
                Seed or clean up test data for development
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600">
                Seed realistic test data including clients, pets, services, and appointments to test the application.
              </p>
              <div className="flex gap-3">
                <Button
                  onClick={async () => {
                    try {
                      await seedMockData.mutateAsync()
                      setSeedMessage('Mock data seeded successfully!')
                      setTimeout(() => setSeedMessage(''), 3000)
                    } catch (error) {
                      setSeedMessage('Failed to seed data. Try cleaning up first.')
                      setTimeout(() => setSeedMessage(''), 3000)
                    }
                  }}
                  disabled={seedMockData.isPending}
                  className="flex-1"
                >
                  <Database className="w-4 h-4 mr-2" />
                  {seedMockData.isPending ? 'Seeding...' : 'Seed Mock Data'}
                </Button>
                <Button
                  variant="destructive"
                  onClick={async () => {
                    try {
                      await cleanupMockData.mutateAsync()
                      setSeedMessage('All data cleaned up!')
                      setTimeout(() => setSeedMessage(''), 3000)
                    } catch (error) {
                      setSeedMessage('Failed to clean up data.')
                      setTimeout(() => setSeedMessage(''), 3000)
                    }
                  }}
                  disabled={cleanupMockData.isPending}
                  className="flex-1"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  {cleanupMockData.isPending ? 'Cleaning...' : 'Clean Mock Data'}
                </Button>
              </div>
              {seedMessage && (
                <p className={`text-sm text-center ${
                  seedMessage.includes('success') || seedMessage.includes('cleaned')
                    ? 'text-green-600'
                    : 'text-red-600'
                }`}>
                  {seedMessage}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
