import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Users } from 'lucide-react'

export default function ClientsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Clients</h1>
        <p className="mt-2 text-gray-600">Manage your client database</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-gray-500" />
            <CardTitle>Client List</CardTitle>
          </div>
          <CardDescription>No clients added yet</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Users className="h-12 w-12 text-gray-400 mb-4" />
            <p className="text-gray-600 mb-4">You don't have any clients yet.</p>
            <Button>Add Client</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
