'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/providers/auth-provider'
// TODO: re-enable useSync when sync worker is deployed
// import { useSync } from 'mpb-localkit/react'
import { app } from '@/lib/offlinekit'
import type { BusinessProfile } from '@/lib/offlinekit/schema'

type WithMeta<T> = T & { _id: string; _deleted: boolean }
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
import { User, Building, Shield, LogOut, MapPin } from 'lucide-react'

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
  const syncStatus: string = 'idle'
  const lastSyncAt: Date | null = null

  const [businessName, setBusinessName] = useState('')
  const [phone, setPhone] = useState('')
  const [timezone, setTimezone] = useState('America/New_York')
  const [serviceAreaMiles, setServiceAreaMiles] = useState(25)
  const [businessLat, setBusinessLat] = useState<string>('')
  const [businessLon, setBusinessLon] = useState<string>('')
  const [geoDetecting, setGeoDetecting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')

  useEffect(() => {
    async function loadProfile() {
      try {
        const profiles = await app.businessProfile.findMany() as WithMeta<BusinessProfile>[]
        const profile = profiles.find((p) => !p._deleted)
        if (profile) {
          setBusinessName(profile.business_name || '')
          setPhone(profile.phone || '')
          setTimezone(profile.timezone || 'America/New_York')
          setServiceAreaMiles(profile.service_area_miles || 25)
          setBusinessLat(profile.business_latitude != null ? String(profile.business_latitude) : '')
          setBusinessLon(profile.business_longitude != null ? String(profile.business_longitude) : '')
        }
      } catch (error) {
        console.error('Failed to load business profile:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadProfile()
  }, [])

  const handleSaveBusinessSettings = async () => {
    setIsSaving(true)
    setSaveMessage('')

    try {
      const parsedLat = businessLat ? parseFloat(businessLat) : null
      const parsedLon = businessLon ? parseFloat(businessLon) : null
      const now = new Date().toISOString()

      const profiles = await app.businessProfile.findMany() as WithMeta<BusinessProfile>[]
      const existing = profiles.find((p) => !p._deleted)

      const profileData = {
        business_name: businessName || null,
        phone: phone || null,
        timezone,
        service_area_miles: serviceAreaMiles,
        business_latitude: parsedLat != null && !isNaN(parsedLat) ? parsedLat : null,
        business_longitude: parsedLon != null && !isNaN(parsedLon) ? parsedLon : null,
        updated_at: now,
        needs_sync: 1 as const,
        sync_operation: 'UPDATE' as const,
      }

      if (existing) {
        await app.businessProfile.update(existing._id, profileData)
      } else {
        await app.businessProfile.create({
          id: crypto.randomUUID(),
          user_id: '00000000-0000-0000-0000-000000000000',
          ...profileData,
          created_at: now,
          version: 1,
          synced_at: null,
          deleted_at: null,
          needs_sync: 1,
          sync_operation: 'INSERT',
        })
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

  const handleSignOut = async () => {
    try {
      await signOut()
    } catch (error) {
      console.error('Sign out error:', error)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="mt-2 text-gray-600">
          Manage your account and application preferences
        </p>
      </div>

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

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={session?.user?.name || 'Not set'} readOnly disabled className="bg-gray-50" />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input value={session?.user?.email || 'Not authenticated'} readOnly disabled className="bg-gray-50" />
                </div>
                <div className="space-y-2">
                  <Label>Email Verified</Label>
                  <Input value={session?.user?.emailVerified ? 'Yes' : 'No'} readOnly disabled className="bg-gray-50" />
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
                Configure your business information
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

                    <Separator />

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Business Location</Label>
                          <p className="text-xs text-gray-500 mt-0.5">
                            Used for weather forecasts when a client has no address
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={geoDetecting}
                          onClick={() => {
                            if (!navigator.geolocation) return
                            setGeoDetecting(true)
                            navigator.geolocation.getCurrentPosition(
                              (pos) => {
                                setBusinessLat(String(Math.round(pos.coords.latitude * 10000) / 10000))
                                setBusinessLon(String(Math.round(pos.coords.longitude * 10000) / 10000))
                                setGeoDetecting(false)
                              },
                              () => setGeoDetecting(false),
                              { enableHighAccuracy: false, timeout: 10000 }
                            )
                          }}
                        >
                          <MapPin className="h-3 w-3 mr-1" />
                          {geoDetecting ? 'Detecting...' : 'Use My Location'}
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label htmlFor="businessLat" className="text-xs">Latitude</Label>
                          <Input
                            id="businessLat"
                            type="text"
                            inputMode="decimal"
                            value={businessLat}
                            onChange={(e) => setBusinessLat(e.target.value)}
                            placeholder="e.g. 40.7128"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="businessLon" className="text-xs">Longitude</Label>
                          <Input
                            id="businessLon"
                            type="text"
                            inputMode="decimal"
                            value={businessLon}
                            onChange={(e) => setBusinessLon(e.target.value)}
                            placeholder="e.g. -74.006"
                          />
                        </div>
                      </div>
                      {businessLat && businessLon && (
                        <p className="text-xs text-green-600">
                          Location set: {businessLat}, {businessLon}
                        </p>
                      )}
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Button onClick={handleSaveBusinessSettings} disabled={isSaving} className="w-full">
                      {isSaving ? 'Saving...' : 'Save Business Settings'}
                    </Button>
                    {saveMessage && (
                      <p className={`text-sm text-center ${saveMessage.includes('success') ? 'text-green-600' : 'text-red-600'}`}>
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
          <Card>
            <CardHeader>
              <CardTitle>Session Management</CardTitle>
              <CardDescription>Sign out of your account</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={handleSignOut} className="w-full">
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sync Status</CardTitle>
              <CardDescription>Current synchronization state</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Status</span>
                <span className={`text-sm font-medium ${syncStatus === 'syncing' ? 'text-blue-600' : 'text-green-600'}`}>
                  {syncStatus === 'syncing' ? 'Syncing...' : syncStatus === 'error' ? 'Error' : 'Ready'}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Last Sync</span>
                <span className="text-sm font-medium text-gray-900">
                  {lastSyncAt ? new Date(lastSyncAt).toLocaleString() : 'Never'}
                </span>
              </div>
            </CardContent>
          </Card>

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
                  <span className="text-sm font-medium text-gray-900">OfflineKit</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="text-red-600">Danger Zone</CardTitle>
              <CardDescription>Irreversible and destructive actions</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="destructive" disabled className="w-full">
                Delete Account
              </Button>
              <p className="text-xs text-gray-500 mt-2 text-center">
                Account deletion is not yet implemented
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
