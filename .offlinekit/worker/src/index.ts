import { Hono } from 'hono'
import { cors } from 'hono/cors'

type Env = {
  DB: D1Database
  BETTER_AUTH_URL: string
}

type Variables = {
  userId: string
}

interface Doc {
  _id: string
  _collection: string
  _updatedAt: number
  _deleted: boolean
  [key: string]: unknown
}

interface Change {
  id: string
  collection: string
  doc: Doc
  updatedAt: number
  deleted: boolean
}

interface PushPayload {
  changes: Change[]
  lastSyncAt: number
}

interface BetterAuthSession {
  user?: { id: string }
  session?: { userId: string }
}

const app = new Hono<{ Bindings: Env; Variables: Variables }>()

app.use('*', cors())

app.use('/sync/*', async (c, next) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const token = authHeader.slice(7)

  let userId: string | undefined
  try {
    const res = await fetch(`${c.env.BETTER_AUTH_URL}/api/auth/get-session`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })

    if (!res.ok) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const data = (await res.json()) as BetterAuthSession
    userId = data.user?.id ?? data.session?.userId
  } catch {
    return c.json({ error: 'Auth service unavailable' }, 503)
  }

  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  c.set('userId', userId)
  await next()
})

// POST /sync/push
// Body: { changes: Change[], lastSyncAt: number }
// Response: 200 OK (body ignored by client; count comes from payload.changes.length)
app.post('/sync/push', async (c) => {
  const userId = c.get('userId')
  const body = await c.req.json<PushPayload>()
  const { changes } = body

  if (!Array.isArray(changes) || changes.length === 0) {
    return c.json({ pushed: 0 })
  }

  const stmts = changes.map((change) =>
    c.env.DB.prepare(
      `INSERT INTO docs (user_id, collection, id, doc, updated_at, deleted)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (user_id, collection, id)
       DO UPDATE SET
         doc        = excluded.doc,
         updated_at = excluded.updated_at,
         deleted    = excluded.deleted
       WHERE excluded.updated_at > docs.updated_at`
    ).bind(
      userId,
      change.collection,
      change.id,
      JSON.stringify(change.doc),
      change.updatedAt,
      change.deleted ? 1 : 0
    )
  )

  await c.env.DB.batch(stmts)

  return c.json({ pushed: changes.length })
})

// GET /sync/pull?since=<epoch_ms>
// Response: { changes: Doc[] }
app.get('/sync/pull', async (c) => {
  const userId = c.get('userId')
  const since = parseInt(c.req.query('since') ?? '0', 10)

  const result = await c.env.DB.prepare(
    `SELECT doc FROM docs
     WHERE user_id = ? AND updated_at > ?
     ORDER BY updated_at ASC`
  )
    .bind(userId, since)
    .all<{ doc: string }>()

  const changes = result.results.map((row) => JSON.parse(row.doc) as Doc)

  return c.json({ changes })
})

app.get('/', (c) => c.json({ status: 'ok', service: 'ke-agenda-sync' }))

export default app
