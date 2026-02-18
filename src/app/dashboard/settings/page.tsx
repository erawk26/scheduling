import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Settings, User, Building, Bell, Shield, Palette } from 'lucide-react'

export default function SettingsPage() {
  const settingsSections = [
    {
      title: 'Profile',
      description: 'Manage your personal information and preferences',
      icon: User,
      items: [
        'Update profile picture',
        'Change email address',
        'Update phone number',
        'Set timezone',
      ],
    },
    {
      title: 'Business Info',
      description: 'Configure your business details and services',
      icon: Building,
      items: [
        'Business name and logo',
        'Service offerings',
        'Operating hours',
        'Service areas',
      ],
    },
    {
      title: 'Notifications',
      description: 'Control how you receive alerts and updates',
      icon: Bell,
      items: [
        'Appointment reminders',
        'Client messages',
        'Weather alerts',
        'Route updates',
      ],
    },
    {
      title: 'Security',
      description: 'Manage your account security settings',
      icon: Shield,
      items: [
        'Change password',
        'Two-factor authentication',
        'Active sessions',
        'Login history',
      ],
    },
    {
      title: 'Appearance',
      description: 'Customize the look and feel of your dashboard',
      icon: Palette,
      items: [
        'Theme preferences',
        'Display density',
        'Calendar view',
        'Language',
      ],
    },
  ]

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="mt-2 text-gray-600">
          Manage your account and preferences
        </p>
      </div>

      {/* Settings Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {settingsSections.map((section) => {
          const Icon = section.icon
          return (
            <Card key={section.title}>
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Icon className="w-5 h-5 text-blue-600" />
                  </div>
                  <CardTitle>{section.title}</CardTitle>
                </div>
                <CardDescription>{section.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {section.items.map((item) => (
                    <li key={item} className="flex items-center space-x-2 text-sm text-gray-600">
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Additional Settings Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-gray-100 rounded-lg">
              <Settings className="w-5 h-5 text-gray-600" />
            </div>
            <CardTitle>Advanced Settings</CardTitle>
          </div>
          <CardDescription>
            Additional configuration options
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <button className="w-full p-4 text-left border rounded-lg hover:bg-gray-50 transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm text-gray-900">Data Export</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Download all your appointments and client data
                  </p>
                </div>
                <div className="text-blue-600 text-sm font-medium">Export</div>
              </div>
            </button>
            <button className="w-full p-4 text-left border rounded-lg hover:bg-gray-50 transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm text-gray-900">Sync Settings</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Manage offline sync and data storage
                  </p>
                </div>
                <div className="text-blue-600 text-sm font-medium">Configure</div>
              </div>
            </button>
            <button className="w-full p-4 text-left border border-red-200 rounded-lg hover:bg-red-50 transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm text-red-600">Delete Account</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Permanently delete your account and all data
                  </p>
                </div>
                <div className="text-red-600 text-sm font-medium">Delete</div>
              </div>
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
