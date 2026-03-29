import { createFileRoute } from '@tanstack/react-router'
import { creditTracker } from '@/lib/graphhopper/client'

export const Route = createFileRoute('/api/credits')({
  server: {
    handlers: {
      GET: async () => {
        const usage = creditTracker.getUsage()
        return Response.json(usage)
      },
    },
  },
})
