'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { app } from '@/lib/offlinekit'
import type { AgentProfile } from '@/lib/offlinekit/schema'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'

type WithMeta<T> = T & { _id: string; _deleted: boolean }
type AgentProfileDoc = WithMeta<AgentProfile>

type SectionId =
  | 'work-schedule'
  | 'service-area'
  | 'travel-rules'
  | 'client-rules'
  | 'personal-commitments'
  | 'business-rules'
  | 'priorities'

async function saveSection(
  sectionId: SectionId,
  content: Record<string, unknown>,
  existing: AgentProfileDoc | undefined
) {
  const now = new Date().toISOString()
  if (existing) {
    await app.agentProfile.update(existing._id, {
      content,
      updated_at: now,
      needs_sync: 1,
      sync_operation: 'UPDATE',
    })
  } else {
    await app.agentProfile.create({
      id: crypto.randomUUID(),
      user_id: '00000000-0000-0000-0000-000000000000',
      section_id: sectionId,
      content,
      created_at: now,
      updated_at: now,
      version: 1,
      synced_at: null,
      deleted_at: null,
      needs_sync: 1,
      sync_operation: 'INSERT',
    })
  }
}

// ── Collapsible section wrapper ───────────────────────────────────────────────

interface SectionWrapperProps {
  title: string
  description: string
  children: React.ReactNode
}

function SectionWrapper({ title, description, children }: SectionWrapperProps) {
  const [open, setOpen] = useState(true)
  return (
    <Card>
      <CardHeader
        className="cursor-pointer select-none flex flex-row items-center justify-between py-4"
        onClick={() => setOpen((o) => !o)}
      >
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription className="text-sm mt-0.5">{description}</CardDescription>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />}
      </CardHeader>
      {open && <CardContent className="pt-0">{children}</CardContent>}
    </Card>
  )
}

// ── Status message helper ─────────────────────────────────────────────────────

function SaveMessage({ message }: { message: string }) {
  if (!message) return null
  const isError = message.toLowerCase().includes('fail') || message.toLowerCase().includes('error')
  return (
    <p className={`text-sm ${isError ? 'text-red-600' : 'text-green-600'}`}>{message}</p>
  )
}

// ── Section action row ────────────────────────────────────────────────────────

interface SectionActionsProps {
  saving: boolean
  onClear: () => void
  message: string
}

function SectionActions({ saving, onClear, message }: SectionActionsProps) {
  return (
    <div className="pt-4 space-y-2">
      <Separator />
      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" size="sm" disabled={saving} className="min-h-[44px]">
          {saving ? 'Saving…' : 'Save Section'}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onClear} className="min-h-[44px]">
          Clear Section
        </Button>
        <SaveMessage message={message} />
      </div>
    </div>
  )
}

// ── 1. Work Schedule ──────────────────────────────────────────────────────────

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const HOURS = Array.from({ length: 24 }, (_, i) => {
  const h = i % 12 || 12
  const ampm = i < 12 ? 'AM' : 'PM'
  return { value: String(i), label: `${h}:00 ${ampm}` }
})

const workScheduleSchema = z.object({
  days_of_week: z.array(z.string()).min(1, 'Select at least one day'),
  start_hour: z.string(),
  end_hour: z.string(),
  break_start: z.string().optional(),
  break_end: z.string().optional(),
  scheduling_horizon_weeks: z.coerce.number().int().min(1).max(52),
  build_day: z.string(),
})
type WorkScheduleValues = z.infer<typeof workScheduleSchema>

function WorkScheduleSection({ existing }: { existing: AgentProfileDoc | undefined }) {
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const defaultValues: WorkScheduleValues = {
    days_of_week: (existing?.content?.days_of_week as string[]) ?? ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    start_hour: (existing?.content?.start_hour as string) ?? '8',
    end_hour: (existing?.content?.end_hour as string) ?? '17',
    break_start: (existing?.content?.break_start as string) ?? '',
    break_end: (existing?.content?.break_end as string) ?? '',
    scheduling_horizon_weeks: (existing?.content?.scheduling_horizon_weeks as number) ?? 4,
    build_day: (existing?.content?.build_day as string) ?? 'Friday',
  }

  const form = useForm<WorkScheduleValues>({ resolver: zodResolver(workScheduleSchema), defaultValues })
  const days = form.watch('days_of_week')
  const startHour = form.watch('start_hour')
  const endHour = form.watch('end_hour')
  const buildDay = form.watch('build_day')

  function toggleDay(day: string) {
    const next = days.includes(day) ? days.filter((d) => d !== day) : [...days, day]
    form.setValue('days_of_week', next)
  }

  async function onSubmit(values: WorkScheduleValues) {
    setSaving(true)
    setMessage('')
    try {
      await saveSection('work-schedule', values as Record<string, unknown>, existing)
      setMessage('Saved!')
      setTimeout(() => setMessage(''), 3000)
    } catch {
      setMessage('Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  function handleClear() {
    form.reset({ days_of_week: [], start_hour: '8', end_hour: '17', break_start: '', break_end: '', scheduling_horizon_weeks: 4, build_day: 'Friday' })
  }

  return (
    <SectionWrapper title="Work Schedule" description="Your working days, hours, and scheduling preferences">
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label>Working Days</Label>
          <div className="flex flex-wrap gap-2">
            {DAYS.map((day) => (
              <button
                key={day}
                type="button"
                onClick={() => toggleDay(day)}
                className={`px-3 py-2 text-sm rounded-md border transition-colors min-h-[44px] ${
                  days.includes(day)
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
                }`}
              >
                {day.slice(0, 3)}
              </button>
            ))}
          </div>
          {form.formState.errors.days_of_week && (
            <p className="text-sm text-red-600">{form.formState.errors.days_of_week.message}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Start Time</Label>
            <Select value={startHour} onValueChange={(v) => form.setValue('start_hour', v)}>
              <SelectTrigger className="min-h-[44px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {HOURS.map((h) => <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>End Time</Label>
            <Select value={endHour} onValueChange={(v) => form.setValue('end_hour', v)}>
              <SelectTrigger className="min-h-[44px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {HOURS.map((h) => <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="break_start">Break Start (optional)</Label>
            <Input id="break_start" type="time" {...form.register('break_start')} className="min-h-[44px]" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="break_end">Break End (optional)</Label>
            <Input id="break_end" type="time" {...form.register('break_end')} className="min-h-[44px]" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="horizon">Scheduling Horizon (weeks)</Label>
            <Input id="horizon" type="number" min={1} max={52} {...form.register('scheduling_horizon_weeks')} className="min-h-[44px]" />
          </div>
          <div className="space-y-1">
            <Label>Schedule Build Day</Label>
            <Select value={buildDay} onValueChange={(v) => form.setValue('build_day', v)}>
              <SelectTrigger className="min-h-[44px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DAYS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <SectionActions saving={saving} onClear={handleClear} message={message} />
      </form>
    </SectionWrapper>
  )
}

// ── 2. Service Area ───────────────────────────────────────────────────────────

const serviceAreaSchema = z.object({
  towns: z.string().min(1, 'Enter at least one town or zone'),
  day_area_notes: z.string().optional(),
})
type ServiceAreaValues = z.infer<typeof serviceAreaSchema>

function ServiceAreaSection({ existing }: { existing: AgentProfileDoc | undefined }) {
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const form = useForm<ServiceAreaValues>({
    resolver: zodResolver(serviceAreaSchema),
    defaultValues: {
      towns: (existing?.content?.towns as string) ?? '',
      day_area_notes: (existing?.content?.day_area_notes as string) ?? '',
    },
  })

  async function onSubmit(values: ServiceAreaValues) {
    setSaving(true)
    setMessage('')
    try {
      await saveSection('service-area', values as Record<string, unknown>, existing)
      setMessage('Saved!')
      setTimeout(() => setMessage(''), 3000)
    } catch {
      setMessage('Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SectionWrapper title="Service Area" description="Towns, zones, and which areas you work on which days">
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="towns">Towns / Zones (one per line)</Label>
          <Textarea
            id="towns"
            {...form.register('towns')}
            placeholder={"Downtown\nNorth Side\nWestfield"}
            rows={4}
            className="resize-none"
          />
          {form.formState.errors.towns && (
            <p className="text-sm text-red-600">{form.formState.errors.towns.message}</p>
          )}
        </div>
        <div className="space-y-1">
          <Label htmlFor="day_area_notes">Day-Area Mapping (optional)</Label>
          <Textarea
            id="day_area_notes"
            {...form.register('day_area_notes')}
            placeholder={"Monday: Downtown, North Side\nTuesday: Westfield\nFriday: Any"}
            rows={4}
            className="resize-none"
          />
          <p className="text-xs text-gray-500">Which areas you prefer to work in on which days</p>
        </div>
        <SectionActions saving={saving} onClear={() => form.reset({ towns: '', day_area_notes: '' })} message={message} />
      </form>
    </SectionWrapper>
  )
}

// ── 3. Travel Rules ───────────────────────────────────────────────────────────

const travelRulesSchema = z.object({
  max_drive_minutes: z.coerce.number().int().min(1).max(480),
  start_location: z.string().optional(),
  end_location: z.string().optional(),
  equipment_notes: z.string().optional(),
})
type TravelRulesValues = z.infer<typeof travelRulesSchema>

function TravelRulesSection({ existing }: { existing: AgentProfileDoc | undefined }) {
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const form = useForm<TravelRulesValues>({
    resolver: zodResolver(travelRulesSchema),
    defaultValues: {
      max_drive_minutes: (existing?.content?.max_drive_minutes as number) ?? 30,
      start_location: (existing?.content?.start_location as string) ?? '',
      end_location: (existing?.content?.end_location as string) ?? '',
      equipment_notes: (existing?.content?.equipment_notes as string) ?? '',
    },
  })

  async function onSubmit(values: TravelRulesValues) {
    setSaving(true)
    setMessage('')
    try {
      await saveSection('travel-rules', values as Record<string, unknown>, existing)
      setMessage('Saved!')
      setTimeout(() => setMessage(''), 3000)
    } catch {
      setMessage('Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  function handleClear() {
    form.reset({ max_drive_minutes: 30, start_location: '', end_location: '', equipment_notes: '' })
  }

  return (
    <SectionWrapper title="Travel Rules" description="Drive time limits and location preferences">
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="max_drive">Max Drive Time Between Appointments (minutes)</Label>
          <Input id="max_drive" type="number" min={1} max={480} {...form.register('max_drive_minutes')} className="min-h-[44px]" />
          {form.formState.errors.max_drive_minutes && (
            <p className="text-sm text-red-600">{form.formState.errors.max_drive_minutes.message}</p>
          )}
        </div>
        <div className="space-y-1">
          <Label htmlFor="start_loc">Preferred Start Location (optional)</Label>
          <Input id="start_loc" {...form.register('start_location')} placeholder="e.g. Home address or downtown" className="min-h-[44px]" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="end_loc">Preferred End Location (optional)</Label>
          <Input id="end_loc" {...form.register('end_location')} placeholder="e.g. Home address or depot" className="min-h-[44px]" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="equip_notes">Equipment Constraints (optional)</Label>
          <Textarea id="equip_notes" {...form.register('equipment_notes')} placeholder="e.g. Large van — avoid narrow streets, need parking" rows={3} className="resize-none" />
        </div>
        <SectionActions saving={saving} onClear={handleClear} message={message} />
      </form>
    </SectionWrapper>
  )
}

// ── 4. Client Rules ───────────────────────────────────────────────────────────

const clientRulesSchema = z.object({
  notes: z.string().optional(),
})
type ClientRulesValues = z.infer<typeof clientRulesSchema>

function ClientRulesSection({ existing }: { existing: AgentProfileDoc | undefined }) {
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const form = useForm<ClientRulesValues>({
    resolver: zodResolver(clientRulesSchema),
    defaultValues: { notes: (existing?.content?.notes as string) ?? '' },
  })

  async function onSubmit(values: ClientRulesValues) {
    setSaving(true)
    setMessage('')
    try {
      await saveSection('client-rules', values as Record<string, unknown>, existing)
      setMessage('Saved!')
      setTimeout(() => setMessage(''), 3000)
    } catch {
      setMessage('Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SectionWrapper title="Client Rules" description="Per-client preferences and special notes">
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="client_notes">Client Notes</Label>
          <Textarea
            id="client_notes"
            {...form.register('notes')}
            placeholder={"e.g.\nAlice Smith — always book first appointment of the day\nBob Jones — needs 90-min slot, never back-to-back"}
            rows={6}
            className="resize-none"
          />
          <p className="text-xs text-gray-500">Freeform notes the agent will use when scheduling specific clients</p>
        </div>
        <SectionActions saving={saving} onClear={() => form.reset({ notes: '' })} message={message} />
      </form>
    </SectionWrapper>
  )
}

// ── 5. Personal Commitments ───────────────────────────────────────────────────

const personalCommitmentsSchema = z.object({
  commitments: z.string().optional(),
})
type PersonalCommitmentsValues = z.infer<typeof personalCommitmentsSchema>

function PersonalCommitmentsSection({ existing }: { existing: AgentProfileDoc | undefined }) {
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const form = useForm<PersonalCommitmentsValues>({
    resolver: zodResolver(personalCommitmentsSchema),
    defaultValues: { commitments: (existing?.content?.commitments as string) ?? '' },
  })

  async function onSubmit(values: PersonalCommitmentsValues) {
    setSaving(true)
    setMessage('')
    try {
      await saveSection('personal-commitments', values as Record<string, unknown>, existing)
      setMessage('Saved!')
      setTimeout(() => setMessage(''), 3000)
    } catch {
      setMessage('Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SectionWrapper title="Personal Commitments" description="Recurring blocks the agent must work around">
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="commitments">Recurring Blocks (one per line)</Label>
          <Textarea
            id="commitments"
            {...form.register('commitments')}
            placeholder={"Monday 3:00 PM – 5:00 PM: School pickup\nWednesday 9:00 AM – 10:30 AM: Gym\nFriday 4:00 PM – 6:00 PM: Family dinner"}
            rows={6}
            className="resize-none"
          />
          <p className="text-xs text-gray-500">Format: Day Start – End: Label</p>
        </div>
        <SectionActions saving={saving} onClear={() => form.reset({ commitments: '' })} message={message} />
      </form>
    </SectionWrapper>
  )
}

// ── 6. Business Rules ─────────────────────────────────────────────────────────

const businessRulesSchema = z.object({
  min_spacing_minutes: z.coerce.number().int().min(0).max(120),
  max_back_to_back: z.coerce.number().int().min(1).max(20),
  equipment_changeover_minutes: z.coerce.number().int().min(0).max(120),
})
type BusinessRulesValues = z.infer<typeof businessRulesSchema>

function BusinessRulesSection({ existing }: { existing: AgentProfileDoc | undefined }) {
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const form = useForm<BusinessRulesValues>({
    resolver: zodResolver(businessRulesSchema),
    defaultValues: {
      min_spacing_minutes: (existing?.content?.min_spacing_minutes as number) ?? 15,
      max_back_to_back: (existing?.content?.max_back_to_back as number) ?? 4,
      equipment_changeover_minutes: (existing?.content?.equipment_changeover_minutes as number) ?? 0,
    },
  })

  async function onSubmit(values: BusinessRulesValues) {
    setSaving(true)
    setMessage('')
    try {
      await saveSection('business-rules', values as Record<string, unknown>, existing)
      setMessage('Saved!')
      setTimeout(() => setMessage(''), 3000)
    } catch {
      setMessage('Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  function handleClear() {
    form.reset({ min_spacing_minutes: 15, max_back_to_back: 4, equipment_changeover_minutes: 0 })
  }

  return (
    <SectionWrapper title="Business Rules" description="Appointment spacing, limits, and changeover time">
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="min_spacing">Minimum Spacing Between Appointments (minutes)</Label>
          <Input id="min_spacing" type="number" min={0} max={120} {...form.register('min_spacing_minutes')} className="min-h-[44px]" />
          {form.formState.errors.min_spacing_minutes && (
            <p className="text-sm text-red-600">{form.formState.errors.min_spacing_minutes.message}</p>
          )}
        </div>
        <div className="space-y-1">
          <Label htmlFor="max_b2b">Max Back-to-Back Appointments</Label>
          <Input id="max_b2b" type="number" min={1} max={20} {...form.register('max_back_to_back')} className="min-h-[44px]" />
          {form.formState.errors.max_back_to_back && (
            <p className="text-sm text-red-600">{form.formState.errors.max_back_to_back.message}</p>
          )}
        </div>
        <div className="space-y-1">
          <Label htmlFor="changeover">Equipment Changeover Time (minutes)</Label>
          <Input id="changeover" type="number" min={0} max={120} {...form.register('equipment_changeover_minutes')} className="min-h-[44px]" />
          <p className="text-xs text-gray-500">Time needed between appointments requiring different equipment</p>
        </div>
        <SectionActions saving={saving} onClear={handleClear} message={message} />
      </form>
    </SectionWrapper>
  )
}

// ── 7. Priorities ─────────────────────────────────────────────────────────────

const PRIORITY_LABELS = [
  { key: 'minimize_driving', label: 'Minimize Driving' },
  { key: 'maximize_bookings', label: 'Maximize Bookings' },
  { key: 'protect_days_off', label: 'Protect Days Off' },
  { key: 'cluster_by_area', label: 'Cluster by Area' },
] as const

const prioritiesSchema = z.object({
  minimize_driving: z.coerce.number().int().min(1).max(4),
  maximize_bookings: z.coerce.number().int().min(1).max(4),
  protect_days_off: z.coerce.number().int().min(1).max(4),
  cluster_by_area: z.coerce.number().int().min(1).max(4),
})
type PrioritiesValues = z.infer<typeof prioritiesSchema>

function PrioritiesSection({ existing }: { existing: AgentProfileDoc | undefined }) {
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const form = useForm<PrioritiesValues>({
    resolver: zodResolver(prioritiesSchema),
    defaultValues: {
      minimize_driving: (existing?.content?.minimize_driving as number) ?? 1,
      maximize_bookings: (existing?.content?.maximize_bookings as number) ?? 2,
      protect_days_off: (existing?.content?.protect_days_off as number) ?? 3,
      cluster_by_area: (existing?.content?.cluster_by_area as number) ?? 4,
    },
  })

  const values = form.watch()

  async function onSubmit(vals: PrioritiesValues) {
    setSaving(true)
    setMessage('')
    try {
      await saveSection('priorities', vals as Record<string, unknown>, existing)
      setMessage('Saved!')
      setTimeout(() => setMessage(''), 3000)
    } catch {
      setMessage('Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  function handleClear() {
    form.reset({ minimize_driving: 1, maximize_bookings: 2, protect_days_off: 3, cluster_by_area: 4 })
  }

  return (
    <SectionWrapper title="Priorities" description="Rank what matters most when building your schedule (1 = highest priority)">
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-3">
          {PRIORITY_LABELS.map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between gap-4">
              <Label className="flex-1">{label}</Label>
              <Select
                value={String(values[key])}
                onValueChange={(v) => form.setValue(key, Number(v) as 1 | 2 | 3 | 4)}
              >
                <SelectTrigger className="w-24 min-h-[44px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4].map((n) => (
                    <SelectItem key={n} value={String(n)}>#{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500">Tip: each priority should have a unique rank.</p>
        <SectionActions saving={saving} onClear={handleClear} message={message} />
      </form>
    </SectionWrapper>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AgentProfilePage() {
  const [sections, setSections] = useState<Partial<Record<SectionId, AgentProfileDoc>>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const docs = await app.agentProfile.findMany() as AgentProfileDoc[]
        const map: Partial<Record<SectionId, AgentProfileDoc>> = {}
        for (const doc of docs) {
          if (!doc._deleted) map[doc.section_id as SectionId] = doc
        }
        setSections(map)
      } catch (error) {
        console.error('Failed to load agent profile:', error)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Agent Profile</h1>
        <p className="mt-2 text-gray-600">
          Tell the scheduling agent about your preferences so it can build smarter schedules.
        </p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading profile…</div>
      ) : (
        <div className="space-y-4">
          <WorkScheduleSection existing={sections['work-schedule']} />
          <ServiceAreaSection existing={sections['service-area']} />
          <TravelRulesSection existing={sections['travel-rules']} />
          <ClientRulesSection existing={sections['client-rules']} />
          <PersonalCommitmentsSection existing={sections['personal-commitments']} />
          <BusinessRulesSection existing={sections['business-rules']} />
          <PrioritiesSection existing={sections['priorities']} />
        </div>
      )}
    </div>
  )
}
