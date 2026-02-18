import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Briefcase, Plus } from 'lucide-react'

export default function ServicesPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Services</h1>
        <p className="mt-2 text-gray-600">Manage services you offer</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-gray-500" />
            <CardTitle>Service Offerings</CardTitle>
          </div>
          <CardDescription>No services configured yet</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Briefcase className="h-12 w-12 text-gray-300 mb-4" />
            <p className="text-gray-500 mb-4">
              Add the services you offer to start scheduling appointments.
            </p>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Service
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
