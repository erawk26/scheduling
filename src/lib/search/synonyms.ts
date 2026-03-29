type SynonymMap = Record<string, string[]>

const SYNONYMS: SynonymMap = {
  packed: ['busy', 'slammed', 'overloaded', 'booked', 'full', 'tight'],
  busy: ['packed', 'slammed', 'overbooked', 'full'],
  free: ['open', 'available', 'clear', 'gap'],
  open: ['free', 'available', 'clear', 'unbooked'],
  available: ['free', 'open', 'clear'],
  cancel: ['cancelled', 'cancellation', 'call off', 'back out'],
  cancelled: ['cancel', 'cancellation'],
  morning: ['am', 'early', 'before noon'],
  afternoon: ['pm', 'after lunch', 'midday'],
  evening: ['night', 'after work', 'late day'],
  move: ['reschedule', 'shift', 'change', 'swap'],
  reschedule: ['move', 'shift', 'change time', 'postpone'],
  shift: ['move', 'reschedule', 'change'],
  client: ['customer', 'pet parent', 'owner', 'patient'],
  customer: ['client', 'owner', 'pet parent'],
  owner: ['client', 'customer', 'pet parent'],
  pet: ['animal', 'dog', 'cat', 'fur baby', 'companion'],
  dog: ['pet', 'animal', 'pup', 'puppy', 'canine'],
  cat: ['pet', 'animal', 'feline', 'kitty'],
  service: ['groom', 'grooming', 'bath', 'cut', 'styling'],
  groom: ['grooming', 'service', 'bath', 'cut', 'styling'],
  grooming: ['groom', 'service', 'bath', 'cut', 'styling'],
  appointment: ['booking', 'reservation', 'session', 'slot'],
  booking: ['appointment', 'reservation', 'session', 'slot'],
  session: ['appointment', 'booking', 'slot'],
  slot: ['appointment', 'booking', 'session', 'time'],
  late: ['running behind', 'delayed', 'tardy'],
  early: ['ahead of schedule', 'before time'],
  'no-show': ['missed', "didn't show", 'absent'],
  missed: ['no-show', 'absent', 'skipped'],
  confirm: ['confirmed', 'approved', 'finalized'],
  confirmed: ['confirm', 'approved'],
  pending: ['unconfirmed', 'waiting', 'tentative'],
  complete: ['completed', 'done', 'finished'],
  completed: ['complete', 'done', 'finished'],
  route: ['drive', 'path', 'direction', 'trip'],
  drive: ['route', 'trip', 'travel'],
  note: ['notes', 'memo', 'comment', 'reminder'],
  notes: ['note', 'memo', 'comment'],
  price: ['cost', 'rate', 'fee', 'charge'],
  cost: ['price', 'rate', 'fee'],
  next: ['upcoming', 'following', 'future'],
  upcoming: ['next', 'future', 'scheduled'],
  today: ['now', 'this day', 'current day'],
  week: ['weekly', 'this week'],
  month: ['monthly', 'this month'],
  address: ['location', 'place', 'where'],
  location: ['address', 'place', 'where'],
  phone: ['number', 'contact', 'call'],
  email: ['contact', 'mail'],
  full: ['packed', 'busy', 'complete', 'booked'],
  tight: ['packed', 'busy', 'compressed'],
}

export function expandQuery(query: string): string {
  if (!query) return query

  const tokens = query.split(/\s+/)
  const expanded = new Set<string>()

  for (const token of tokens) {
    expanded.add(token)
    const synonyms = SYNONYMS[token.toLowerCase()]
    if (synonyms) {
      for (const syn of synonyms) {
        expanded.add(syn)
      }
    }
  }

  return Array.from(expanded).join(' ')
}
