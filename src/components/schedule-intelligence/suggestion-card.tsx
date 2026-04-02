import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Clock, MapPin } from 'lucide-react';
import type { ScheduleSuggestion } from '@/lib/schedule-intelligence/types';

function getFlexibilityBadge(flexibility: ScheduleSuggestion['clientFlexibility']): {
  label: string;
  className: string;
} {
  if (flexibility === 'flexible') {
    return { label: 'Flexible', className: 'bg-success-muted text-success-muted-foreground border-success-muted-foreground/20' };
  }
  if (flexibility === 'fixed') {
    return { label: 'Fixed', className: 'bg-destructive/10 text-destructive border-destructive/20' };
  }
  return { label: 'Unknown', className: 'bg-warning-muted text-warning-muted-foreground border-warning-muted-foreground/20' };
}

interface SuggestionCardProps {
  suggestion: ScheduleSuggestion;
  onApply: (suggestion: ScheduleSuggestion) => void;
  isApplying?: boolean;
}

export function SuggestionCard({ suggestion, onApply, isApplying = false }: SuggestionCardProps) {
  const flexBadge = getFlexibilityBadge(suggestion.clientFlexibility);
  const hasSavings = suggestion.estimatedMilesSaved > 0 || suggestion.estimatedMinutesSaved > 0;

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-foreground">{suggestion.clientName}</p>
              <Badge className={flexBadge.className}>{flexBadge.label}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{suggestion.serviceName}</p>

            <div className="flex items-center gap-2 text-sm">
              <span className="text-foreground">
                {suggestion.currentDay} {suggestion.currentTime}
              </span>
              <ArrowRight className="h-4 w-4 flex-shrink-0 text-primary" />
              <span className="font-medium text-primary">
                {suggestion.suggestedDay} {suggestion.suggestedTime}
              </span>
            </div>

            <p className="text-sm text-muted-foreground italic">{suggestion.reason}</p>

            {hasSavings && (
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                {suggestion.estimatedMilesSaved > 0 && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-success-muted-foreground" />
                    ~{suggestion.estimatedMilesSaved.toFixed(1)} miles saved
                  </span>
                )}
                {suggestion.estimatedMinutesSaved > 0 && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3 text-success-muted-foreground" />
                    ~{Math.round(suggestion.estimatedMinutesSaved)} min saved
                  </span>
                )}
              </div>
            )}
          </div>

          <Button
            size="sm"
            onClick={() => onApply(suggestion)}
            disabled={isApplying}
            className="min-h-[44px] flex-shrink-0"
            aria-label={`Apply suggestion for ${suggestion.clientName}`}
          >
            {isApplying ? 'Applying…' : 'Apply'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
