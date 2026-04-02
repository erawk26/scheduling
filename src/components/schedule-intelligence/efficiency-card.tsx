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
    return { label: 'Efficient', className: 'bg-success-muted text-success-muted-foreground border-success-muted-foreground/20' };
  }
  if (percent >= 60) {
    return { label: 'Moderate', className: 'bg-warning-muted text-warning-muted-foreground border-warning-muted-foreground/20' };
  }
  return { label: 'Inefficient', className: 'bg-destructive/10 text-destructive border-destructive/20' };
}

function getEfficiencyColor(percent: number): string {
  if (percent >= 85) return 'text-success-muted-foreground';
  if (percent >= 60) return 'text-warning-muted-foreground';
  return 'text-destructive';
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
          <span className="text-sm text-muted-foreground">efficiency</span>
        </div>

        <div className="space-y-1.5 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
            <span>
              {toMiles(day.actualDistanceKm)} mi driven
              {day.optimalDistanceKm > 0 && (
                <span className="text-muted-foreground"> / {toMiles(day.optimalDistanceKm)} mi optimal</span>
              )}
            </span>
          </div>

          {day.estimatedWastedMinutes > 0 && (
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
              <span>~{Math.round(day.estimatedWastedMinutes)} min wasted</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
            <span>
              {day.appointmentCount} appointment{day.appointmentCount !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
