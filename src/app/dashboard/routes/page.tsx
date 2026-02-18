import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Route, MapPin } from 'lucide-react'

export default function RoutesPage() {
  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Routes</h1>
        <p className="mt-2 text-gray-600">
          Optimize your daily driving routes
        </p>
      </div>

      {/* Route Optimization Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Route className="w-5 h-5 text-blue-600" />
            </div>
            <CardTitle>Route Optimization</CardTitle>
          </div>
          <CardDescription>
            AI-powered route planning to save time and fuel
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <MapPin className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">No routes to display</p>
            <p className="text-sm text-gray-400 mt-2 max-w-md mx-auto">
              Once you have appointments scheduled at different locations, route optimization will automatically plan the most efficient driving route for your day.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Planned Features */}
      <Card>
        <CardHeader>
          <CardTitle>Planned Features</CardTitle>
          <CardDescription>
            What route optimization will provide
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-4 border rounded-lg">
              <Route className="w-8 h-8 text-blue-400 mx-auto mb-3" />
              <p className="font-medium text-sm text-gray-900 mb-1">Optimized Routes</p>
              <p className="text-xs text-gray-500">Save up to 25% on drive time with smart ordering</p>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <MapPin className="w-8 h-8 text-blue-400 mx-auto mb-3" />
              <p className="font-medium text-sm text-gray-900 mb-1">Turn-by-Turn</p>
              <p className="text-xs text-gray-500">Directions between stops with traffic awareness</p>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <Route className="w-8 h-8 text-blue-400 mx-auto mb-3" />
              <p className="font-medium text-sm text-gray-900 mb-1">Multi-Stop Planning</p>
              <p className="text-xs text-gray-500">Handle up to 20 stops per day efficiently</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
