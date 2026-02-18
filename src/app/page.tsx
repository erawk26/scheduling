import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar, Cloud, Route, Wifi } from 'lucide-react'

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            KE Agenda
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Local-first scheduling platform for mobile service professionals
          </p>
          <div className="flex justify-center gap-4">
            <Button asChild size="lg">
              <Link href="/sign-in">Sign In</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/sign-up">Get Started</Link>
            </Button>
          </div>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <Calendar className="w-6 h-6 text-blue-600" />
              </div>
              <CardTitle className="text-lg">Smart Scheduling</CardTitle>
              <CardDescription>
                Manage appointments with intelligent conflict detection
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                <Wifi className="w-6 h-6 text-green-600" />
              </div>
              <CardTitle className="text-lg">72+ Hours Offline</CardTitle>
              <CardDescription>
                Full functionality without internet connection
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center mb-4">
                <Cloud className="w-6 h-6 text-amber-600" />
              </div>
              <CardTitle className="text-lg">Weather Integration</CardTitle>
              <CardDescription>
                Proactive rescheduling for weather-dependent services
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                <Route className="w-6 h-6 text-purple-600" />
              </div>
              <CardTitle className="text-lg">Route Optimization</CardTitle>
              <CardDescription>
                Save 25% drive time with smart routing
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    </div>
  )
}
