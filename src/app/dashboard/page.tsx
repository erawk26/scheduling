import { useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import { format, parseISO } from 'date-fns';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Calendar,
  Users,
  Briefcase,
  DollarSign,
  Plus,
  Settings as SettingsIcon,
} from 'lucide-react';
import { useServices } from '@/hooks/use-services';
import { useClients } from '@/hooks/use-clients';
import { useTodayAppointments, useAppointments } from '@/hooks/use-appointments';

export default function DashboardPage() {
  const { data: services, isLoading } = useServices();
  const { data: clients } = useClients();
  const { data: todayAppointments } = useTodayAppointments();
  const { data: allAppointments } = useAppointments();
  const upcomingStartDate = useMemo(() => new Date().toISOString(), []);
  const { data: upcomingAppointments } = useAppointments({
    startDate: upcomingStartDate,
  });

  // Create lookup maps for client and service names (memoized)
  const clientMap = useMemo(
    () => new Map(clients?.map((c) => [c.id, c]) || []),
    [clients]
  );
  const serviceMap = useMemo(
    () => new Map(services?.map((s) => [s.id, s]) || []),
    [services]
  );

  // Get stats with real data
  const stats = [
    {
      title: "Today's Appointments",
      value: todayAppointments?.length || 0,
      icon: Calendar,
    },
    {
      title: 'Total Clients',
      value: clients?.length || 0,
      icon: Users,
    },
    {
      title: 'Active Services',
      value: services?.length || 0,
      icon: Briefcase,
    },
    {
      title: 'Revenue (This Month)',
      value: (() => {
        if (!allAppointments || !services) return '--';
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const completedThisMonth = allAppointments.filter(
          (apt) =>
            apt.status === 'completed' &&
            new Date(apt.start_time) >= monthStart
        );
        const serviceMap = new Map(services.map((s) => [s.id, s]));
        const totalCents = completedThisMonth.reduce((sum, apt) => {
          const svc = serviceMap.get(apt.service_id);
          return sum + (svc?.price_cents || 0);
        }, 0);
        return totalCents > 0 ? `$${(totalCents / 100).toFixed(2)}` : '$0';
      })(),
      icon: DollarSign,
    },
  ];

  // Show skeleton loading state while data is loading
  if (isLoading) {
    return (
      <div className="space-y-8">
        <div>
          <Skeleton className="h-9 w-48 mb-2" />
          <Skeleton className="h-5 w-96" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-8 rounded-lg" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-12" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-64" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-32" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-48" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-48" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Get upcoming appointments (limit to 5)
  const upcomingList = upcomingAppointments?.slice(0, 5) || [];

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
          const Icon = stat.icon;
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
          );
        })}
      </div>

      {/* Upcoming Appointments & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Appointments</CardTitle>
            <CardDescription>Your next scheduled appointments</CardDescription>
          </CardHeader>
          <CardContent>
            {upcomingList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Calendar className="w-12 h-12 text-gray-300 mb-4" />
                <p className="text-gray-500 mb-4">
                  No appointments scheduled yet.
                </p>
                <Button asChild>
                  <Link to="/dashboard/appointments">
                    <Plus className="w-4 h-4 mr-2" />
                    Schedule Appointment
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {upcomingList.map((appointment) => {
                  const client = clientMap.get(appointment.client_id);
                  const service = serviceMap.get(appointment.service_id);
                  const clientName = client
                    ? `${client.first_name} ${client.last_name}`
                    : 'Unknown';
                  const serviceName = service?.name || 'Unknown Service';

                  return (
                    <div
                      key={appointment.id}
                      className="flex items-start justify-between p-3 border rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">
                          {clientName}
                        </p>
                        <p className="text-sm text-gray-600">{serviceName}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {format(parseISO(appointment.start_time), 'MMM d')} at{' '}
                          {format(parseISO(appointment.start_time), 'h:mm a')}
                        </p>
                      </div>
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          appointment.status === 'confirmed'
                            ? 'bg-green-100 text-green-700'
                            : appointment.status === 'scheduled'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {appointment.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
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
                <Link to="/dashboard/appointments">
                  <Calendar className="w-4 h-4 mr-2" />
                  Schedule New Appointment
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link to="/dashboard/clients">
                  <Users className="w-4 h-4 mr-2" />
                  Add New Client
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link to="/dashboard/services">
                  <Briefcase className="w-4 h-4 mr-2" />
                  Manage Services
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link to="/dashboard/settings">
                  <SettingsIcon className="w-4 h-4 mr-2" />
                  Settings
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
