import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Cloud, Sun } from 'lucide-react'

export default function WeatherPage() {
  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Weather</h1>
        <p className="mt-2 text-gray-600">
          Weather-integrated scheduling for outdoor services
        </p>
      </div>

      {/* Weather Integration Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Cloud className="w-5 h-5 text-blue-600" />
            </div>
            <CardTitle>Weather Integration</CardTitle>
          </div>
          <CardDescription>
            Proactive scheduling with weather forecasts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <Sun className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">Weather integration not yet configured</p>
            <p className="text-sm text-gray-400 mt-2 max-w-md mx-auto">
              Connect a weather service to get real-time forecasts, automatic rescheduling for outdoor appointments, and weather alerts for your service area.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Planned Features */}
      <Card>
        <CardHeader>
          <CardTitle>Planned Features</CardTitle>
          <CardDescription>
            What weather integration will provide
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-4 border rounded-lg">
              <Cloud className="w-8 h-8 text-blue-400 mx-auto mb-3" />
              <p className="font-medium text-sm text-gray-900 mb-1">Real-time Forecasts</p>
              <p className="text-xs text-gray-500">Current conditions and 5-day outlook for your area</p>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <Cloud className="w-8 h-8 text-blue-400 mx-auto mb-3" />
              <p className="font-medium text-sm text-gray-900 mb-1">Smart Rescheduling</p>
              <p className="text-xs text-gray-500">Proactively reschedule outdoor appointments before bad weather</p>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <Cloud className="w-8 h-8 text-blue-400 mx-auto mb-3" />
              <p className="font-medium text-sm text-gray-900 mb-1">Weather Alerts</p>
              <p className="text-xs text-gray-500">Get notified about weather that could affect your schedule</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
