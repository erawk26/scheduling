'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, Clock, MapPin, Lightbulb, CheckCircle, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWeeklyAnalysis } from '@/hooks/use-schedule-analysis';
import {
  useScheduleSuggestions,
  useApplySuggestion,
  useApplyAllSuggestions,
} from '@/hooks/use-schedule-suggestions';
import { EfficiencyCard } from '@/components/schedule-intelligence/efficiency-card';
import { SuggestionCard } from '@/components/schedule-intelligence/suggestion-card';
import type { ScheduleSuggestion } from '@/lib/schedule-intelligence/types';

const KM_TO_MILES = 0.621371;

function toMiles(km: number): string {
  return (km * KM_TO_MILES).toFixed(1);
}

function AnalysisSkeletons() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-lg" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-40 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

function SuggestionsSkeletons() {
  return (
    <div className="space-y-3">
      {[...Array(3)].map((_, i) => (
        <Skeleton key={i} className="h-32 rounded-lg" />
      ))}
    </div>
  );
}

export default function ScheduleIntelligencePage() {
  const [activeTab, setActiveTab] = useState<'analysis' | 'suggestions'>('analysis');
  const [applyingId, setApplyingId] = useState<string | null>(null);

  const { data: weeklyData, isLoading: analysisLoading, error: analysisError } = useWeeklyAnalysis(1);
  const { data: suggestions, isLoading: suggestionsLoading, error: suggestionsError } = useScheduleSuggestions();

  const applySuggestion = useApplySuggestion();
  const applyAll = useApplyAllSuggestions();

  async function handleApply(suggestion: ScheduleSuggestion) {
    setApplyingId(suggestion.id);
    try {
      await applySuggestion.mutateAsync(suggestion);
    } finally {
      setApplyingId(null);
    }
  }

  async function handleApplyAll() {
    if (!suggestions?.suggestions) return;
    await applyAll.mutateAsync(suggestions.suggestions);
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Schedule Intelligence</h1>
        <p className="mt-2 text-gray-600">
          Analyze past route efficiency and optimize upcoming appointments
        </p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('analysis')}
          className={cn(
            'flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors min-h-[44px]',
            activeTab === 'analysis'
              ? 'bg-primary text-white'
              : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
          )}
          aria-pressed={activeTab === 'analysis'}
        >
          <TrendingUp className="h-4 w-4" />
          Last Week
        </button>
        <button
          onClick={() => setActiveTab('suggestions')}
          className={cn(
            'flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors min-h-[44px]',
            activeTab === 'suggestions'
              ? 'bg-primary text-white'
              : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
          )}
          aria-pressed={activeTab === 'suggestions'}
        >
          <Lightbulb className="h-4 w-4" />
          Next Week
        </button>
      </div>

      {/* Last Week tab */}
      {activeTab === 'analysis' && (
        <div className="space-y-4">
          {analysisError && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-6">
                <p className="text-sm text-red-700">Failed to load analysis data.</p>
              </CardContent>
            </Card>
          )}

          {analysisLoading ? (
            <AnalysisSkeletons />
          ) : weeklyData ? (
            <>
              {/* Weekly summary */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <div className="rounded-lg bg-blue-100 p-2">
                      <TrendingUp className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <CardTitle>Weekly Summary</CardTitle>
                      <CardDescription>
                        {weeklyData.weekStart} — {weeklyData.weekEnd}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                    <div className="flex items-center gap-3 rounded-lg border bg-gray-50 p-4">
                      <div className="rounded-lg bg-blue-100 p-2">
                        <TrendingUp className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-gray-900">
                          {Math.round(weeklyData.totalEfficiencyPercent)}%
                        </p>
                        <p className="text-xs text-gray-500">Overall efficiency</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 rounded-lg border bg-gray-50 p-4">
                      <div className="rounded-lg bg-green-100 p-2">
                        <MapPin className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-gray-900">
                          {toMiles(weeklyData.totalActualKm)}
                        </p>
                        <p className="text-xs text-gray-500">Miles driven</p>
                      </div>
                    </div>

                    <div className="col-span-2 flex items-center gap-3 rounded-lg border bg-gray-50 p-4 sm:col-span-1">
                      <div className="rounded-lg bg-amber-100 p-2">
                        <Clock className="h-5 w-5 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-gray-900">
                          {Math.round(weeklyData.totalWastedMinutes)} min
                        </p>
                        <p className="text-xs text-gray-500">Wasted drive time</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Per-day cards */}
              {weeklyData.days.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {weeklyData.days.map((day) => (
                    <EfficiencyCard key={day.date} day={day} />
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                    <Calendar className="mb-4 h-16 w-16 text-gray-300" />
                    <p className="font-medium text-gray-500">No daily data available</p>
                    <p className="mt-2 max-w-sm text-sm text-gray-400">
                      No appointments with location data were found for last week.
                    </p>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <TrendingUp className="mb-4 h-16 w-16 text-gray-300" />
                <p className="font-medium text-gray-500">No data for last week</p>
                <p className="mt-2 max-w-sm text-sm text-gray-400">
                  Complete appointments with location data to see your route efficiency analysis.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Next Week tab */}
      {activeTab === 'suggestions' && (
        <div className="space-y-4">
          {suggestionsError && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-6">
                <p className="text-sm text-red-700">Failed to load suggestions.</p>
              </CardContent>
            </Card>
          )}

          {suggestionsLoading ? (
            <SuggestionsSkeletons />
          ) : suggestions && suggestions.suggestions.length > 0 ? (
            <>
              {/* Savings summary */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <div className="rounded-lg bg-blue-100 p-2">
                      <Lightbulb className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <CardTitle>Optimization Available</CardTitle>
                      <CardDescription>
                        {suggestions.suggestions.length} suggested change
                        {suggestions.suggestions.length !== 1 ? 's' : ''} for next week
                      </CardDescription>
                    </div>
                    <Button
                      onClick={handleApplyAll}
                      disabled={applyAll.isPending}
                      className="min-h-[44px]"
                      aria-label="Apply all suggestions"
                    >
                      <CheckCircle className="mr-2 h-4 w-4" />
                      {applyAll.isPending ? 'Applying…' : 'Apply All'}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-4">
                    {suggestions.totalMilesSaved > 0 && (
                      <div className="flex items-center gap-2 rounded-lg border bg-green-50 px-4 py-3">
                        <MapPin className="h-5 w-5 text-green-600" />
                        <div>
                          <p className="font-semibold text-green-800">
                            ~{suggestions.totalMilesSaved.toFixed(1)} miles
                          </p>
                          <p className="text-xs text-green-600">potential savings</p>
                        </div>
                      </div>
                    )}
                    {suggestions.totalMinutesSaved > 0 && (
                      <div className="flex items-center gap-2 rounded-lg border bg-blue-50 px-4 py-3">
                        <Clock className="h-5 w-5 text-blue-600" />
                        <div>
                          <p className="font-semibold text-blue-800">
                            ~{Math.round(suggestions.totalMinutesSaved)} min
                          </p>
                          <p className="text-xs text-blue-600">potential savings</p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Suggestion cards */}
              <div className="space-y-3">
                {suggestions.suggestions.map((suggestion) => (
                  <SuggestionCard
                    key={suggestion.id}
                    suggestion={suggestion}
                    onApply={handleApply}
                    isApplying={applyingId === suggestion.id || applySuggestion.isPending}
                  />
                ))}
              </div>
            </>
          ) : suggestions ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <CheckCircle className="mb-4 h-16 w-16 text-green-300" />
                <p className="font-medium text-gray-700">All routes are already efficient!</p>
                <p className="mt-2 max-w-sm text-sm text-gray-400">
                  Next week's schedule is already well-optimized. No changes suggested.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Lightbulb className="mb-4 h-16 w-16 text-gray-300" />
                <p className="font-medium text-gray-500">No suggestions available</p>
                <p className="mt-2 max-w-sm text-sm text-gray-400">
                  Add scheduled appointments with location data for next week to receive
                  optimization suggestions.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
