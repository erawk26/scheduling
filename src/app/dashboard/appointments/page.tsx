import { useState, useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format, parseISO, addMinutes, startOfDay, endOfDay } from 'date-fns';
import {
  Calendar,
  List,
  Plus,
  Clock,
  MapPin,
  MoreVertical,
  Loader2,
  CheckCheck,
  MessageSquare,
  Filter,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import {
  useAppointments,
  useCreateAppointment,
  useUpdateAppointment,
  useUpdateAppointmentStatus,
  useDeleteAppointment,
} from '@/hooks/use-appointments';
import { useClients } from '@/hooks/use-clients';
import { useServices } from '@/hooks/use-services';
import { usePets } from '@/hooks/use-pets';
import { appointmentSchema, type AppointmentFormData } from '@/lib/validations';
import type { Appointment, Client, Service } from '@/lib/offlinekit/schema';
import { CalendarView } from '@/components/appointments/calendar-view';
import { AppointmentWeatherBadge } from '@/components/appointments/weather-badge';
import { useWeatherForecast } from '@/hooks/use-weather';
import { useUserLocation } from '@/hooks/use-user-location';
import { useBusinessLocation } from '@/hooks/use-business-location';
import type { WeatherForecast } from '@/lib/weather/types';


const statusColors: Record<Appointment['status'], string> = {
  draft: 'bg-warning-muted text-warning-muted-foreground',
  pending: 'bg-warning-muted text-warning-muted-foreground',
  scheduled: 'bg-info-muted text-info-muted-foreground',
  confirmed: 'bg-success-muted text-success-muted-foreground',
  in_progress: 'bg-fern-pale text-primary',
  completed: 'bg-info-muted text-info-muted-foreground',
  cancelled: 'bg-destructive/10 text-destructive',
  no_show: 'bg-secondary text-foreground',
};

const statusLabels: Record<Appointment['status'], string> = {
  draft: 'Draft',
  pending: 'Pending',
  scheduled: 'Scheduled',
  confirmed: 'Confirmed',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No Show',
};

export default function AppointmentsPage() {
  const navigate = useNavigate();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [showDraftsOnly, setShowDraftsOnly] = useState(false);
  const [isConfirmingDrafts, setIsConfirmingDrafts] = useState(false);

  // Get today's date range (memoized to prevent re-render loops)
  const todayStart = useMemo(() => startOfDay(new Date()).toISOString(), []);
  const todayEnd = useMemo(() => endOfDay(new Date()).toISOString(), []);
  const now = useMemo(() => new Date().toISOString(), []);

  // Query appointments for different tabs
  const { data: todayAppointments, isLoading: isLoadingToday } = useAppointments({
    startDate: todayStart,
    endDate: todayEnd,
  });

  const { data: allAppointments, isLoading: isLoadingAll } = useAppointments();

  // Batch status updater (used for confirm all drafts)
  const updateStatus = useUpdateAppointmentStatus();

  // Draft appointments
  const draftAppointments = useMemo(() => {
    if (!allAppointments) return [];
    return allAppointments.filter((apt) => apt.status === 'draft');
  }, [allAppointments]);

  // Appointments shown in calendar/list (filtered by showDraftsOnly)
  const displayedAppointments = useMemo(() => {
    if (!allAppointments) return [];
    return showDraftsOnly ? draftAppointments : allAppointments;
  }, [allAppointments, draftAppointments, showDraftsOnly]);

  // Filter appointments for each tab
  const upcomingAppointments = useMemo(() => {
    const base = showDraftsOnly ? draftAppointments : allAppointments ?? [];
    const validStatuses = showDraftsOnly
      ? (['draft'] as const)
      : (['scheduled', 'confirmed'] as const);
    return base.filter(
      (apt) => apt.start_time > now && (validStatuses as readonly string[]).includes(apt.status)
    );
  }, [allAppointments, draftAppointments, now, showDraftsOnly]);

  const pastAppointments = useMemo(() => {
    const base = showDraftsOnly ? draftAppointments : allAppointments ?? [];
    if (showDraftsOnly) {
      return base.filter((apt) => apt.start_time < now);
    }
    return base.filter(
      (apt) =>
        apt.start_time < now ||
        apt.status === 'completed' ||
        apt.status === 'cancelled' ||
        apt.status === 'no_show'
    );
  }, [allAppointments, draftAppointments, now, showDraftsOnly]);

  const displayedTodayAppointments = useMemo(() => {
    if (!todayAppointments) return [];
    return showDraftsOnly
      ? todayAppointments.filter((apt) => apt.status === 'draft')
      : todayAppointments;
  }, [todayAppointments, showDraftsOnly]);

  const handleConfirmAllDrafts = async () => {
    if (draftAppointments.length === 0) return;
    setIsConfirmingDrafts(true);
    try {
      for (const apt of draftAppointments) {
        await updateStatus.mutateAsync({ id: apt.id, status: 'confirmed' });
      }
    } finally {
      setIsConfirmingDrafts(false);
    }
  };

  // Query clients and services for lookups
  const { data: clients } = useClients();
  const { data: services } = useServices();

  // Business location fallback for weather badges
  const { data: bizLoc } = useBusinessLocation();

  // Weather forecasts for calendar view (business location → browser geolocation)
  const { lat: userLat, lon: userLon } = useUserLocation();
  const calendarLat = bizLoc?.lat ?? userLat;
  const calendarLon = bizLoc?.lon ?? userLon;
  const { data: weatherForecasts } = useWeatherForecast(calendarLat, calendarLon);

  // Build forecast lookup by date
  const forecastByDate = useMemo(() => {
    if (!weatherForecasts) return new Map<string, WeatherForecast>();
    return new Map(weatherForecasts.map((f) => [f.date, f]));
  }, [weatherForecasts]);

  // Create lookup maps
  const clientsMap = useMemo(() => {
    if (!clients) return new Map<string, Client>();
    return new Map(clients.map((c) => [c.id, c]));
  }, [clients]);

  const servicesMap = useMemo(() => {
    if (!services) return new Map<string, Service>();
    return new Map(services.map((s) => [s.id, s]));
  }, [services]);

  if (isLoadingAll && !allAppointments?.length) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Appointments</h1>
          <p className="mt-2 text-muted-foreground">
            Manage your upcoming and past appointments
          </p>
        </div>
        <div className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Appointments</h1>
          <p className="mt-2 text-muted-foreground">
            Manage your upcoming and past appointments
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {draftAppointments.length > 0 && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleConfirmAllDrafts}
                disabled={isConfirmingDrafts}
                className="border-success-muted-foreground/20 text-success-muted-foreground hover:bg-success-muted"
              >
                {isConfirmingDrafts ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCheck className="mr-2 h-4 w-4" />
                )}
                Confirm All Drafts
                <Badge className="ml-2 bg-warning-muted text-warning-muted-foreground border-warning-muted-foreground/20">
                  {draftAppointments.length}
                </Badge>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate({ to: '/dashboard/chat' })}
              >
                <MessageSquare className="mr-2 h-4 w-4" />
                Ask Agent to Adjust
              </Button>
            </>
          )}
          <Button
            variant={showDraftsOnly ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setShowDraftsOnly((v) => !v)}
          >
            <Filter className="mr-2 h-4 w-4" />
            {showDraftsOnly ? 'Show All' : 'Drafts Only'}
          </Button>
          <div className="flex items-center gap-1">
            <Button
              variant={viewMode === 'calendar' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('calendar')}
            >
              <Calendar className="mr-2 h-4 w-4" />
              Calendar
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('list')}
            >
              <List className="mr-2 h-4 w-4" />
              List
            </Button>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Schedule Appointment
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Schedule Appointment</DialogTitle>
                <DialogDescription>
                  Create a new appointment for a client
                </DialogDescription>
              </DialogHeader>
              <AppointmentForm
                clients={clients || []}
                services={services || []}
                onSuccess={() => setIsCreateDialogOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {viewMode === 'calendar' ? (
        <CalendarView
          appointments={displayedAppointments}
          clientsMap={clientsMap}
          servicesMap={servicesMap}
          forecastByDate={forecastByDate}
          onAppointmentClick={setEditingAppointment}
          onCreateAppointment={() => setIsCreateDialogOpen(true)}
        />
      ) : (
        <Tabs defaultValue="today" className="space-y-4">
          <TabsList>
            <TabsTrigger value="today">Today</TabsTrigger>
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="past">Past</TabsTrigger>
          </TabsList>

          <TabsContent value="today" className="space-y-4">
            {isLoadingToday ? (
              <div className="space-y-4">
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : displayedTodayAppointments.length > 0 ? (
              displayedTodayAppointments.map((appointment) => (
                <AppointmentCard
                  key={appointment.id}
                  appointment={appointment}
                  client={clientsMap.get(appointment.client_id)}
                  service={servicesMap.get(appointment.service_id)}
                  fallbackLat={bizLoc?.lat}
                  fallbackLon={bizLoc?.lon}
                  onEdit={setEditingAppointment}
                />
              ))
            ) : (
              <EmptyState message="No appointments scheduled for today" />
            )}
          </TabsContent>

          <TabsContent value="upcoming" className="space-y-4">
            {isLoadingAll ? (
              <div className="space-y-4">
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : upcomingAppointments.length > 0 ? (
              upcomingAppointments.map((appointment) => (
                <AppointmentCard
                  key={appointment.id}
                  appointment={appointment}
                  client={clientsMap.get(appointment.client_id)}
                  service={servicesMap.get(appointment.service_id)}
                  fallbackLat={bizLoc?.lat}
                  fallbackLon={bizLoc?.lon}
                  onEdit={setEditingAppointment}
                />
              ))
            ) : (
              <EmptyState message="No upcoming appointments" />
            )}
          </TabsContent>

          <TabsContent value="past" className="space-y-4">
            {isLoadingAll ? (
              <div className="space-y-4">
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : pastAppointments.length > 0 ? (
              pastAppointments.map((appointment) => (
                <AppointmentCard
                  key={appointment.id}
                  appointment={appointment}
                  client={clientsMap.get(appointment.client_id)}
                  service={servicesMap.get(appointment.service_id)}
                  fallbackLat={bizLoc?.lat}
                  fallbackLon={bizLoc?.lon}
                  onEdit={setEditingAppointment}
                />
              ))
            ) : (
              <EmptyState message="No past appointments" />
            )}
          </TabsContent>
        </Tabs>
      )}

      {editingAppointment && (
        <Dialog
          open={!!editingAppointment}
          onOpenChange={(open) => !open && setEditingAppointment(null)}
        >
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Appointment</DialogTitle>
              <DialogDescription>
                Update appointment details
              </DialogDescription>
            </DialogHeader>
            <AppointmentForm
              clients={clients || []}
              services={services || []}
              appointment={editingAppointment}
              onSuccess={() => setEditingAppointment(null)}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

interface AppointmentCardProps {
  appointment: Appointment;
  client?: Client;
  service?: Service;
  fallbackLat?: number | null;
  fallbackLon?: number | null;
  onEdit: (appointment: Appointment) => void;
}

function AppointmentCard({
  appointment,
  client,
  service,
  fallbackLat,
  fallbackLon,
  onEdit,
}: AppointmentCardProps) {
  const updateStatus = useUpdateAppointmentStatus();
  const deleteAppointment = useDeleteAppointment();

  const handleStatusChange = (status: Appointment['status']) => {
    updateStatus.mutate({ id: appointment.id, status });
  };

  const handleDelete = () => {
    deleteAppointment.mutate(appointment.id);
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-semibold">
                {client
                  ? `${client.first_name} ${client.last_name}`
                  : 'Unknown Client'}
              </h3>
              <Badge className={statusColors[appointment.status]}>
                {statusLabels[appointment.status]}
              </Badge>
              <AppointmentWeatherBadge
                clientLat={client?.latitude ?? appointment.latitude ?? null}
                clientLon={client?.longitude ?? appointment.longitude ?? null}
                fallbackLat={fallbackLat}
                fallbackLon={fallbackLon}
                appointmentDate={appointment.start_time}
                isWeatherDependent={!!service?.weather_dependent}
              />
            </div>

            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>
                  {format(parseISO(appointment.start_time), 'MMM d, yyyy')}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>
                  {format(parseISO(appointment.start_time), 'h:mm a')} -{' '}
                  {format(parseISO(appointment.end_time), 'h:mm a')}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-medium">Service:</span>
                <span>{service?.name || 'Unknown Service'}</span>
              </div>

              {appointment.address && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  <span>{appointment.address}</span>
                </div>
              )}

              {appointment.notes && (
                <div className="mt-2 pt-2 border-t">
                  <p className="text-sm">{appointment.notes}</p>
                </div>
              )}
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(appointment)}>
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleStatusChange('confirmed')}
                disabled={appointment.status === 'confirmed'}
              >
                Mark Confirmed
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleStatusChange('in_progress')}
                disabled={appointment.status === 'in_progress'}
              >
                Mark In Progress
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleStatusChange('completed')}
                disabled={appointment.status === 'completed'}
              >
                Mark Completed
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleStatusChange('no_show')}
                disabled={appointment.status === 'no_show'}
              >
                Mark No Show
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10 -ml-2">
                Cancel
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Cancel Appointment</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to cancel this appointment? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep Appointment</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-destructive hover:bg-destructive/90"
                >
                  Cancel Appointment
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}

interface AppointmentFormProps {
  clients: Client[];
  services: Service[];
  appointment?: Appointment;
  onSuccess: () => void;
}

function AppointmentForm({
  clients,
  services,
  appointment,
  onSuccess,
}: AppointmentFormProps) {
  const [selectedClientId, setSelectedClientId] = useState(
    appointment?.client_id || ''
  );
  const [selectedServiceId, setSelectedServiceId] = useState(
    appointment?.service_id || ''
  );

  const { data: pets } = usePets(selectedClientId);
  const createAppointment = useCreateAppointment();
  const updateAppointment = useUpdateAppointment();

  const selectedService = services.find((s) => s.id === selectedServiceId);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<AppointmentFormData>({
    resolver: zodResolver(appointmentSchema as any),
    defaultValues: appointment
      ? {
          client_id: appointment.client_id,
          service_id: appointment.service_id,
          pet_id: appointment.pet_id || undefined,
          start_time: appointment.start_time,
          end_time: appointment.end_time,
          status: appointment.status as AppointmentFormData['status'],
          location_type: appointment.location_type as AppointmentFormData['location_type'],
          address: appointment.address || undefined,
          notes: appointment.notes || undefined,
          internal_notes: appointment.internal_notes || undefined,
        }
      : {
          status: 'scheduled',
          location_type: 'client_location',
        },
  });

  const startTime = watch('start_time');

  // Format a Date as a local datetime string (no timezone)
  const formatLocalDateTime = (date: Date): string => {
    return format(date, "yyyy-MM-dd'T'HH:mm:ss");
  };

  // Parse a datetime string that may or may not have timezone info
  const parseDateTime = (value: string): Date => {
    return parseISO(value);
  };

  // Auto-calculate end time when start time or service changes
  const handleStartTimeChange = (value: string) => {
    setValue('start_time', value);
    if (selectedService && value) {
      try {
        const start = parseDateTime(value);
        const end = addMinutes(start, selectedService.duration_minutes);
        setValue('end_time', formatLocalDateTime(end));
      } catch (e) {
        console.error('Error calculating end time:', e);
      }
    }
  };

  const handleServiceChange = (serviceId: string) => {
    setSelectedServiceId(serviceId);
    setValue('service_id', serviceId);
    const service = services.find((s) => s.id === serviceId);
    if (service && startTime) {
      try {
        const start = parseDateTime(startTime);
        const end = addMinutes(start, service.duration_minutes);
        setValue('end_time', formatLocalDateTime(end));
      } catch (e) {
        console.error('Error calculating end time:', e);
      }
    }
  };

  const onSubmit = async (data: AppointmentFormData) => {
    try {
      if (appointment) {
        await updateAppointment.mutateAsync({ id: appointment.id, data });
      } else {
        await createAppointment.mutateAsync(data);
      }
      onSuccess();
    } catch (error) {
      console.error('Error saving appointment:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-4">
        <div>
          <Label htmlFor="client_id">Client{!appointment && ' *'}</Label>
          <Select
            value={selectedClientId}
            disabled={!!appointment}
            onValueChange={(value) => {
              setSelectedClientId(value);
              setValue('client_id', value);
              setValue('pet_id', undefined);
              const newClient = clients.find((c) => c.id === value);
              setValue('address', newClient?.address || '');
            }}
          >
            <SelectTrigger id="client_id">
              <SelectValue placeholder="Select a client" />
            </SelectTrigger>
            <SelectContent>
              {clients.map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.first_name} {client.last_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.client_id && (
            <p className="mt-1 text-sm text-destructive">
              {errors.client_id.message}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="service_id">Service *</Label>
          <Select
            value={selectedServiceId}
            onValueChange={handleServiceChange}
          >
            <SelectTrigger id="service_id">
              <SelectValue placeholder="Select a service" />
            </SelectTrigger>
            <SelectContent>
              {services.map((service) => (
                <SelectItem key={service.id} value={service.id}>
                  {service.name} ({service.duration_minutes} min)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.service_id && (
            <p className="mt-1 text-sm text-destructive">
              {errors.service_id.message}
            </p>
          )}
        </div>

        {selectedClientId && pets && pets.length > 0 && (
          <div>
            <Label htmlFor="pet_id">Pet (Optional)</Label>
            <Select
              value={watch('pet_id') || 'none'}
              onValueChange={(value) =>
                setValue('pet_id', value === 'none' ? undefined : value)
              }
            >
              <SelectTrigger id="pet_id">
                <SelectValue placeholder="Select a pet (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {pets.map((pet) => (
                  <SelectItem key={pet.id} value={pet.id}>
                    {pet.name} ({pet.species})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="date">Date *</Label>
            <Input
              id="date"
              type="date"
              onChange={(e) => {
                const date = e.target.value;
                if (!date) return;
                const currentStart = watch('start_time');
                const time = currentStart
                  ? format(parseDateTime(currentStart), 'HH:mm')
                  : '09:00';
                const dateTime = `${date}T${time}:00`;
                handleStartTimeChange(dateTime);
              }}
              value={
                watch('start_time')
                  ? format(parseDateTime(watch('start_time')), 'yyyy-MM-dd')
                  : ''
              }
            />
            {errors.start_time && (
              <p className="mt-1 text-sm text-destructive">
                {errors.start_time.message}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="time">Start Time *</Label>
            <Input
              id="time"
              type="time"
              value={
                watch('start_time')
                  ? format(parseDateTime(watch('start_time')), 'HH:mm')
                  : ''
              }
              onChange={(e) => {
                const time = e.target.value;
                if (!time) return;
                const currentStart = watch('start_time');
                const date = currentStart
                  ? format(parseDateTime(currentStart), 'yyyy-MM-dd')
                  : format(new Date(), 'yyyy-MM-dd');
                const dateTime = `${date}T${time}:00`;
                handleStartTimeChange(dateTime);
              }}
            />
            {errors.start_time && (
              <p className="mt-1 text-sm text-destructive">
                {errors.start_time.message}
              </p>
            )}
          </div>
        </div>

        <div>
          <Label htmlFor="end_time">End Time *</Label>
          <Input
            id="end_time"
            type="time"
            value={
              watch('end_time')
                ? format(parseDateTime(watch('end_time')), 'HH:mm')
                : ''
            }
            onChange={(e) => {
              const time = e.target.value;
              if (!time) return;
              const currentStart = watch('start_time');
              const date = currentStart
                ? format(parseDateTime(currentStart), 'yyyy-MM-dd')
                : format(new Date(), 'yyyy-MM-dd');
              const dateTime = `${date}T${time}:00`;
              setValue('end_time', dateTime);
            }}
          />
          {errors.end_time && (
            <p className="mt-1 text-sm text-destructive">
              {errors.end_time.message}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="location_type">Location Type *</Label>
          <Select
            value={watch('location_type')}
            onValueChange={(value) =>
              setValue('location_type', value as any)
            }
          >
            <SelectTrigger id="location_type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="client_location">Client Location</SelectItem>
              <SelectItem value="business_location">
                Business Location
              </SelectItem>
              <SelectItem value="mobile">Mobile</SelectItem>
            </SelectContent>
          </Select>
          {errors.location_type && (
            <p className="mt-1 text-sm text-destructive">
              {errors.location_type.message}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="address">Address (Optional)</Label>
          <Input id="address" {...register('address')} />
          {errors.address && (
            <p className="mt-1 text-sm text-destructive">
              {errors.address.message}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="notes">Notes (Optional)</Label>
          <Textarea id="notes" {...register('notes')} rows={3} />
          {errors.notes && (
            <p className="mt-1 text-sm text-destructive">{errors.notes.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="internal_notes">Internal Notes (Optional)</Label>
          <Textarea
            id="internal_notes"
            {...register('internal_notes')}
            rows={2}
          />
          {errors.internal_notes && (
            <p className="mt-1 text-sm text-destructive">
              {errors.internal_notes.message}
            </p>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onSuccess}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {appointment ? 'Update' : 'Create'} Appointment
        </Button>
      </div>
    </form>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  );
}
