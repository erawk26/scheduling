import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Calendar, Users, Briefcase, DollarSign, Plus, Route, Cloud } from 'lucide-react'

export default function DashboardPage() {
  const stats = [
    {
      title: "Today's Appointments",
      value: '0',
      icon: Calendar,
    },
    {
      title: 'Total Clients',
      value: '0',
      icon: Users,
    },
    {
      title: 'Active Services',
      value: '0',
      icon: Briefcase,
    },
    {
      title: 'Revenue (This Month)',
      value: '$0',
      icon: DollarSign,
    },
  ]

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-2 text-gray-600">
          Welcome back! Here&apos;s an overview of your business.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  {stat.title}
                </CardTitle>
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Icon className="w-4 h-4 text-blue-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Getting Started */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Appointments</CardTitle>
            <CardDescription>Your next scheduled appointments</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Calendar className="w-12 h-12 text-gray-300 mb-4" />
              <p className="text-gray-500 mb-4">No appointments scheduled yet.</p>
              <Button asChild>
                <Link href="/dashboard/appointments">
                  <Plus className="w-4 h-4 mr-2" />
                  Schedule Appointment
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks and shortcuts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href="/dashboard/appointments">
                  <Calendar className="w-4 h-4 mr-2" />
                  Schedule New Appointment
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href="/dashboard/clients">
                  <Users className="w-4 h-4 mr-2" />
                  Add New Client
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href="/dashboard/services">
                  <Briefcase className="w-4 h-4 mr-2" />
                  Manage Services
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href="/dashboard/routes">
                  <Route className="w-4 h-4 mr-2" />
                  View Routes
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href="/dashboard/weather">
                  <Cloud className="w-4 h-4 mr-2" />
                  Check Weather
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
