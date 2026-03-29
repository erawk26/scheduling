import { useState, useMemo } from 'react';
import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  isToday,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  getHours,
  getMinutes,
  startOfDay,
} from 'date-fns';
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { Appointment } from '@/lib/offlinekit/schema';
import type { WeatherForecast } from '@/lib/weather/types';
import { WeatherDayIcon } from '@/components/appointments/weather-badge';

// ============================================================================
// Types
// ============================================================================

type CalendarView = 'day' | 'week' | 'month';

type AppointmentStatus = Appointment['status'];

interface CalendarViewProps {
  appointments: Appointment[];
  clientsMap: Map<string, { first_name: string; last_name: string }>;
  servicesMap: Map<string, { name: string; duration_minutes: number }>;
  forecastByDate?: Map<string, WeatherForecast>;
  onDateSelect?: (date: Date) => void;
  onAppointmentClick?: (appointment: Appointment) => void;
  onCreateAppointment?: (date: Date) => void;
}

// ============================================================================
// Constants
// ============================================================================

const WEEK_DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const DAY_HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 7am–8pm

const STATUS_COLORS: Record<AppointmentStatus, string> = {
  draft: 'bg-amber-50 text-amber-800 border-amber-300',
  pending: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  scheduled: 'bg-blue-100 text-blue-800 border-blue-200',
  confirmed: 'bg-green-100 text-green-800 border-green-200',
  in_progress: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  completed: 'bg-gray-100 text-gray-800 border-gray-200',
  cancelled: 'bg-red-100 text-red-800 border-red-200',
  no_show: 'bg-orange-100 text-orange-800 border-orange-200',
};

// Height of one hour slot in pixels (used for week/day time positioning)
const HOUR_HEIGHT = 64;

// ============================================================================
// Helpers
// ============================================================================

function formatHour(hour: number): string {
  if (hour === 0) return '12am';
  if (hour < 12) return `${hour}am`;
  if (hour === 12) return '12pm';
  return `${hour - 12}pm`;
}

function getAppointmentLabel(
  appointment: Appointment,
  clientsMap: Map<string, { first_name: string; last_name: string }>
): string {
  const client = clientsMap.get(appointment.client_id);
  const time = format(parseISO(appointment.start_time), 'h:mma');
  const name = client ? `${client.first_name} ${client.last_name}` : 'Unknown';
  return `${time} ${name}`;
}

/**
 * Returns the top offset (px) and height (px) for an appointment block
 * relative to the 7am baseline within a HOUR_HEIGHT-per-hour grid.
 */
function getTimePosition(
  startIso: string,
  endIso: string
): { top: number; height: number } {
  const start = parseISO(startIso);
  const end = parseISO(endIso);
  const startMinutesFromBase = (getHours(start) - 7) * 60 + getMinutes(start);
  const endMinutesFromBase = (getHours(end) - 7) * 60 + getMinutes(end);
  const top = (startMinutesFromBase / 60) * HOUR_HEIGHT;
  const height = Math.max(((endMinutesFromBase - startMinutesFromBase) / 60) * HOUR_HEIGHT, 20);
  return { top, height };
}

/**
 * Returns whether an appointment falls (at least partially) on the given day
 * and within the visible 7am–8pm window.
 */
function appointmentOnDay(appointment: Appointment, day: Date): boolean {
  const start = parseISO(appointment.start_time);
  return isSameDay(start, day);
}

// ============================================================================
// Sub-components
// ============================================================================

interface AppointmentPillProps {
  appointment: Appointment;
  clientsMap: Map<string, { first_name: string; last_name: string }>;
  onClick?: (appointment: Appointment) => void;
  className?: string;
}

function AppointmentPill({ appointment, clientsMap, onClick, className }: AppointmentPillProps) {
  const isDraft = appointment.status === 'draft';
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Appointment: ${getAppointmentLabel(appointment, clientsMap)}${isDraft ? ' (Draft)' : ''}`}
      className={cn(
        'text-xs px-1 py-0.5 rounded border cursor-pointer select-none flex items-center gap-0.5 overflow-hidden',
        'transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500',
        isDraft && 'border-dashed opacity-70',
        STATUS_COLORS[appointment.status],
        className
      )}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(appointment);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          onClick?.(appointment);
        }
      }}
    >
      {isDraft && <span className="shrink-0 font-bold text-[10px] uppercase">D</span>}
      <span className="truncate">{getAppointmentLabel(appointment, clientsMap)}</span>
    </div>
  );
}

// ============================================================================
// Month View
// ============================================================================

interface MonthViewProps {
  currentDate: Date;
  appointments: Appointment[];
  clientsMap: Map<string, { first_name: string; last_name: string }>;
  forecastByDate?: Map<string, WeatherForecast>;
  onDateSelect?: (date: Date) => void;
  onAppointmentClick?: (appointment: Appointment) => void;
}

function MonthView({ currentDate, appointments, clientsMap, forecastByDate, onDateSelect, onAppointmentClick }: MonthViewProps) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  return (
    <div className="flex flex-col">
      {/* Day-of-week header */}
      <div className="grid grid-cols-7 border-b">
        {WEEK_DAY_LABELS.map((label) => (
          <div
            key={label}
            className="py-2 text-xs font-medium text-gray-500 text-center border-r last:border-r-0"
          >
            {label}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const dayAppointments = appointments.filter((apt) => appointmentOnDay(apt, day));
          const overflow = dayAppointments.length - 3;
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isTodayDay = isToday(day);

          return (
            <div
              key={day.toISOString()}
              role="button"
              tabIndex={0}
              aria-label={format(day, 'MMMM d, yyyy')}
              className={cn(
                'min-h-[100px] p-2 border-r border-b last:border-r-0 cursor-pointer',
                'focus-visible:outline-none focus-visible:ring-inset focus-visible:ring-1 focus-visible:ring-blue-400',
                !isCurrentMonth && 'bg-gray-50',
                isTodayDay && 'bg-blue-50',
                isCurrentMonth && !isTodayDay && 'hover:bg-gray-50',
              )}
              onClick={() => onDateSelect?.(day)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onDateSelect?.(day);
                }
              }}
            >
              {/* Day number + weather icon */}
              <div className="flex items-center justify-between mb-1">
                <div
                  className={cn(
                    'text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full',
                    isTodayDay
                      ? 'bg-blue-600 text-white'
                      : isCurrentMonth
                      ? 'text-gray-900'
                      : 'text-gray-400'
                  )}
                >
                  {format(day, 'd')}
                </div>
                {(() => {
                  const dateStr = format(day, 'yyyy-MM-dd');
                  const forecast = forecastByDate?.get(dateStr);
                  return forecast ? <WeatherDayIcon forecast={forecast} /> : null;
                })()}
              </div>

              {/* Appointment pills */}
              <div className="space-y-0.5">
                {dayAppointments.slice(0, 3).map((apt) => (
                  <AppointmentPill
                    key={apt.id}
                    appointment={apt}
                    clientsMap={clientsMap}
                    onClick={onAppointmentClick}
                  />
                ))}
                {overflow > 0 && (
                  <div className="text-xs text-gray-500 pl-1">+{overflow} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// Week View
// ============================================================================

interface WeekViewProps {
  currentDate: Date;
  appointments: Appointment[];
  clientsMap: Map<string, { first_name: string; last_name: string }>;
  onDateSelect?: (date: Date) => void;
  onAppointmentClick?: (appointment: Appointment) => void;
}

function WeekView({ currentDate, appointments, clientsMap, onDateSelect, onAppointmentClick }: WeekViewProps) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const totalHeight = DAY_HOURS.length * HOUR_HEIGHT;

  return (
    <div className="flex flex-col overflow-hidden">
      {/* Column headers */}
      <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b">
        <div className="border-r" /> {/* gutter */}
        {weekDays.map((day) => (
          <div
            key={day.toISOString()}
            className={cn(
              'py-2 text-center border-r last:border-r-0',
              isToday(day) && 'bg-blue-50'
            )}
          >
            <div className="text-xs text-gray-500">{format(day, 'EEE')}</div>
            <div
              className={cn(
                'mx-auto mt-0.5 w-8 h-8 flex items-center justify-center rounded-full text-sm font-semibold',
                isToday(day) ? 'bg-blue-600 text-white' : 'text-gray-900'
              )}
            >
              {format(day, 'd')}
            </div>
          </div>
        ))}
      </div>

      {/* Scrollable time grid */}
      <div className="overflow-y-auto" style={{ maxHeight: '560px' }}>
        <div className="grid grid-cols-[56px_repeat(7,1fr)]" style={{ height: totalHeight }}>
          {/* Hour labels */}
          <div className="relative border-r">
            {DAY_HOURS.map((hour, idx) => (
              <div
                key={hour}
                className="absolute w-full flex items-start justify-end pr-2"
                style={{ top: idx * HOUR_HEIGHT, height: HOUR_HEIGHT }}
              >
                <span className="text-xs text-gray-400 -mt-2">{formatHour(hour)}</span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekDays.map((day) => {
            const dayAppointments = appointments.filter((apt) => appointmentOnDay(apt, day));
            return (
              <div
                key={day.toISOString()}
                role="button"
                tabIndex={0}
                aria-label={`Schedule for ${format(day, 'EEEE, MMMM d')}`}
                className={cn(
                  'relative border-r last:border-r-0 cursor-pointer',
                  'focus-visible:outline-none focus-visible:ring-inset focus-visible:ring-1 focus-visible:ring-blue-400',
                  isToday(day) && 'bg-blue-50/40'
                )}
                style={{ height: totalHeight }}
                onClick={() => onDateSelect?.(day)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onDateSelect?.(day);
                  }
                }}
              >
                {/* Hour grid lines */}
                {DAY_HOURS.map((_, idx) => (
                  <div
                    key={idx}
                    className="absolute w-full border-t border-gray-100"
                    style={{ top: idx * HOUR_HEIGHT }}
                  />
                ))}

                {/* Appointment blocks */}
                {dayAppointments.map((apt) => {
                  const { top, height } = getTimePosition(apt.start_time, apt.end_time);
                  const client = clientsMap.get(apt.client_id);
                  const clientName = client
                    ? `${client.first_name} ${client.last_name}`
                    : 'Unknown';
                  const isDraft = apt.status === 'draft';
                  return (
                    <div
                      key={apt.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`Appointment with ${clientName}${isDraft ? ' (Draft)' : ''}`}
                      className={cn(
                        'absolute left-0.5 right-0.5 rounded border px-1 py-0.5 overflow-hidden cursor-pointer',
                        'transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500',
                        isDraft && 'border-dashed opacity-70',
                        STATUS_COLORS[apt.status]
                      )}
                      style={{ top, height }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onAppointmentClick?.(apt);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          e.stopPropagation();
                          onAppointmentClick?.(apt);
                        }
                      }}
                    >
                      {isDraft && (
                        <div className="text-[9px] font-bold uppercase leading-none mb-0.5 tracking-wide">Draft</div>
                      )}
                      <div className="text-xs font-medium truncate">
                        {format(parseISO(apt.start_time), 'h:mma')}
                      </div>
                      <div className="text-xs truncate">{clientName}</div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Day View
// ============================================================================

interface DayViewProps {
  currentDate: Date;
  appointments: Appointment[];
  clientsMap: Map<string, { first_name: string; last_name: string }>;
  servicesMap: Map<string, { name: string; duration_minutes: number }>;
  onAppointmentClick?: (appointment: Appointment) => void;
}

function DayView({ currentDate, appointments, clientsMap, servicesMap, onAppointmentClick }: DayViewProps) {
  const dayAppointments = appointments.filter((apt) =>
    appointmentOnDay(apt, currentDate)
  );
  const totalHeight = DAY_HOURS.length * HOUR_HEIGHT;

  return (
    <div className="flex flex-col overflow-hidden">
      {/* Day header */}
      <div
        className={cn(
          'flex items-center justify-center py-3 border-b',
          isToday(currentDate) && 'bg-blue-50'
        )}
      >
        <div className="text-center">
          <div className="text-xs text-gray-500">{format(currentDate, 'EEEE')}</div>
          <div
            className={cn(
              'mx-auto mt-0.5 w-10 h-10 flex items-center justify-center rounded-full text-lg font-bold',
              isToday(currentDate) ? 'bg-blue-600 text-white' : 'text-gray-900'
            )}
          >
            {format(currentDate, 'd')}
          </div>
        </div>
      </div>

      {/* Scrollable time column */}
      <div className="overflow-y-auto" style={{ maxHeight: '560px' }}>
        <div className="grid grid-cols-[56px_1fr]" style={{ height: totalHeight }}>
          {/* Hour labels */}
          <div className="relative border-r">
            {DAY_HOURS.map((hour, idx) => (
              <div
                key={hour}
                className="absolute w-full flex items-start justify-end pr-2"
                style={{ top: idx * HOUR_HEIGHT, height: HOUR_HEIGHT }}
              >
                <span className="text-xs text-gray-400 -mt-2">{formatHour(hour)}</span>
              </div>
            ))}
          </div>

          {/* Appointment column */}
          <div className="relative" style={{ height: totalHeight }}>
            {/* Hour grid lines */}
            {DAY_HOURS.map((_, idx) => (
              <div
                key={idx}
                className="absolute w-full border-t border-gray-100"
                style={{ top: idx * HOUR_HEIGHT }}
              />
            ))}

            {/* Appointment blocks */}
            {dayAppointments.map((apt) => {
              const { top, height } = getTimePosition(apt.start_time, apt.end_time);
              const client = clientsMap.get(apt.client_id);
              const service = servicesMap.get(apt.service_id);
              const clientName = client
                ? `${client.first_name} ${client.last_name}`
                : 'Unknown Client';
              const serviceName = service?.name ?? 'Unknown Service';
              const isDraft = apt.status === 'draft';

              return (
                <div
                  key={apt.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`${clientName} — ${serviceName}${isDraft ? ' (Draft)' : ''}`}
                  className={cn(
                    'absolute left-1 right-1 rounded border px-2 py-1 overflow-hidden cursor-pointer',
                    'transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500',
                    isDraft && 'border-dashed opacity-70',
                    STATUS_COLORS[apt.status]
                  )}
                  style={{ top, height }}
                  onClick={() => onAppointmentClick?.(apt)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onAppointmentClick?.(apt);
                    }
                  }}
                >
                  {isDraft && (
                    <span className="inline-block text-[10px] font-bold uppercase tracking-wide border border-dashed border-amber-400 rounded px-1 leading-4 mb-0.5 bg-amber-100 text-amber-800">
                      DRAFT
                    </span>
                  )}
                  <div className="flex items-center gap-1 text-xs font-semibold">
                    <Clock className="w-3 h-3 shrink-0" />
                    <span>
                      {format(parseISO(apt.start_time), 'h:mm a')} &ndash;{' '}
                      {format(parseISO(apt.end_time), 'h:mm a')}
                    </span>
                  </div>
                  <div className="text-xs font-medium mt-0.5 truncate">{clientName}</div>
                  {height >= 48 && (
                    <div className="text-xs truncate opacity-75">{serviceName}</div>
                  )}
                  {height >= 72 && apt.address && (
                    <div className="text-xs truncate opacity-60 mt-0.5">{apt.address}</div>
                  )}
                </div>
              );
            })}

            {/* Empty state */}
            {dayAppointments.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <p className="text-sm text-gray-400">No appointments</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// CalendarView (main export)
// ============================================================================

export function CalendarView({
  appointments,
  clientsMap,
  servicesMap,
  forecastByDate,
  onDateSelect,
  onAppointmentClick,
  onCreateAppointment: _onCreateAppointment,
}: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState<Date>(startOfDay(new Date()));
  const [view, setView] = useState<CalendarView>('month');

  // Filter out soft-deleted appointments
  const visibleAppointments = useMemo(
    () => appointments.filter((apt) => apt.deleted_at === null),
    [appointments]
  );

  // ---- Navigation ----
  const goToPrev = () => {
    if (view === 'month') setCurrentDate((d) => subMonths(d, 1));
    else if (view === 'week') setCurrentDate((d) => subWeeks(d, 1));
    else setCurrentDate((d) => subDays(d, 1));
  };

  const goToNext = () => {
    if (view === 'month') setCurrentDate((d) => addMonths(d, 1));
    else if (view === 'week') setCurrentDate((d) => addWeeks(d, 1));
    else setCurrentDate((d) => addDays(d, 1));
  };

  const goToToday = () => setCurrentDate(startOfDay(new Date()));

  // ---- Period label ----
  const periodLabel = useMemo(() => {
    if (view === 'month') return format(currentDate, 'MMMM yyyy');
    if (view === 'week') {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });
      if (isSameMonth(weekStart, weekEnd)) {
        return `${format(weekStart, 'MMM d')} – ${format(weekEnd, 'd, yyyy')}`;
      }
      return `${format(weekStart, 'MMM d')} – ${format(weekEnd, 'MMM d, yyyy')}`;
    }
    return format(currentDate, 'EEEE, MMMM d, yyyy');
  }, [currentDate, view]);

  // ---- Date select handler (also navigates in week/day views) ----
  const handleDateSelect = (date: Date) => {
    setCurrentDate(startOfDay(date));
    onDateSelect?.(date);
  };

  return (
    <Card className="w-full overflow-hidden">
      {/* ---- Header ---- */}
      <CardHeader className="pb-0 px-4 pt-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Navigation */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              aria-label="Previous period"
              onClick={goToPrev}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>

            <h2 className="text-base font-semibold text-gray-900 min-w-[180px] text-center">
              {periodLabel}
            </h2>

            <Button
              variant="outline"
              size="icon"
              aria-label="Next period"
              onClick={goToNext}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="ml-1"
              onClick={goToToday}
            >
              Today
            </Button>
          </div>

          {/* View switcher */}
          <div className="flex items-center gap-1">
            {(['day', 'week', 'month'] as CalendarView[]).map((v) => (
              <Button
                key={v}
                variant={view === v ? 'default' : 'outline'}
                size="sm"
                onClick={() => setView(v)}
                aria-pressed={view === v}
                className="capitalize"
              >
                {v}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>

      {/* ---- Calendar grid ---- */}
      <CardContent className="p-0 mt-3 border-t">
        {view === 'month' && (
          <MonthView
            currentDate={currentDate}
            appointments={visibleAppointments}
            clientsMap={clientsMap}
            forecastByDate={forecastByDate}
            onDateSelect={handleDateSelect}
            onAppointmentClick={onAppointmentClick}
          />
        )}
        {view === 'week' && (
          <WeekView
            currentDate={currentDate}
            appointments={visibleAppointments}
            clientsMap={clientsMap}
            onDateSelect={handleDateSelect}
            onAppointmentClick={onAppointmentClick}
          />
        )}
        {view === 'day' && (
          <DayView
            currentDate={currentDate}
            appointments={visibleAppointments}
            clientsMap={clientsMap}
            servicesMap={servicesMap}
            onAppointmentClick={onAppointmentClick}
          />
        )}
      </CardContent>
    </Card>
  );
}
