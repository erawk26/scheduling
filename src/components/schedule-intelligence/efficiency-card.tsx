import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Clock, CalendarDays } from 'lucide-react';
import type { DayEfficiency } from '@/lib/schedule-intelligence/types';

const KM_TO_MILES = 0.621371;

function toMiles(km: number): string {
  return (km * KM_TO_MILES).toFixed(1);
}

function getEfficiencyBadge(percent: number): { label: string; className: string } {
  if (percent >= 85) {
    return { label: 'Efficient', className: 'bg-green-100 text-green-700 border-green-200' };
  }
  if (percent >= 60) {
    return { label: 'Moderate', className: 'bg-amber-100 text-amber-700 border-amber-200' };
  }
  return { label: 'Inefficient', className: 'bg-red-100 text-red-700 border-red-200' };
}

function getEfficiencyColor(percent: number): string {
  if (percent >= 85) return 'text-green-600';
  if (percent >= 60) return 'text-amber-600';
  return 'text-red-600';
}

interface EfficiencyCardProps {
  day: DayEfficiency;
}

export function EfficiencyCard({ day }: EfficiencyCardProps) {
  const badge = getEfficiencyBadge(day.efficiencyPercent);
  const percentColor = getEfficiencyColor(day.efficiencyPercent);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">{day.dayOfWeek}</CardTitle>
          <Badge className={badge.className}>{badge.label}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-baseline gap-1">
          <span className={`text-3xl font-bold ${percentColor}`}>
            {Math.round(day.efficiencyPercent)}%
          </span>
          <span className="text-sm text-gray-500">efficiency</span>
        </div>

        <div className="space-y-1.5 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 flex-shrink-0 text-gray-400" />
            <span>
              {toMiles(day.actualDistanceKm)} mi driven
              {day.optimalDistanceKm > 0 && (
                <span className="text-gray-400"> / {toMiles(day.optimalDistanceKm)} mi optimal</span>
              )}
            </span>
          </div>

          {day.estimatedWastedMinutes > 0 && (
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 flex-shrink-0 text-gray-400" />
              <span>~{Math.round(day.estimatedWastedMinutes)} min wasted</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 flex-shrink-0 text-gray-400" />
            <span>
              {day.appointmentCount} appointment{day.appointmentCount !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
