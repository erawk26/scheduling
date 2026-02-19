'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useClients, useCreateClient } from '@/hooks/use-clients';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { clientSchema, type ClientFormData } from '@/lib/validations';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Plus, Search, Mail, Phone, MapPin } from 'lucide-react';

export default function ClientsPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: clients, isLoading } = useClients(search);
  const createClient = useCreateClient();

  const form = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      address: '',
      notes: '',
    },
  });

  const onSubmit = async (data: ClientFormData) => {
    try {
      await createClient.mutateAsync(data);
      form.reset();
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Failed to create client:', error);
    }
  };

  const handleCardClick = (clientId: string) => {
    router.push(`/dashboard/clients/${clientId}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Clients</h1>
          <p className="mt-2 text-gray-600">Manage your client database</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Client
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Client</DialogTitle>
              <DialogDescription>
                Enter client information below
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name">First Name *</Label>
                  <Input
                    id="first_name"
                    autoComplete="given-name"
                    {...form.register('first_name')}
                    placeholder="John"
                  />
                  {form.formState.errors.first_name && (
                    <p className="text-sm text-red-600">
                      {form.formState.errors.first_name.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">Last Name *</Label>
                  <Input
                    id="last_name"
                    autoComplete="family-name"
                    {...form.register('last_name')}
                    placeholder="Doe"
                  />
                  {form.formState.errors.last_name && (
                    <p className="text-sm text-red-600">
                      {form.formState.errors.last_name.message}
                    </p>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  {...form.register('email')}
                  placeholder="john.doe@example.com"
                />
                {form.formState.errors.email && (
                  <p className="text-sm text-red-600">
                    {form.formState.errors.email.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  autoComplete="tel"
                  {...form.register('phone')}
                  placeholder="(555) 123-4567"
                />
                {form.formState.errors.phone && (
                  <p className="text-sm text-red-600">
                    {form.formState.errors.phone.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  autoComplete="street-address"
                  {...form.register('address')}
                  placeholder="123 Main St, City, State 12345"
                />
                {form.formState.errors.address && (
                  <p className="text-sm text-red-600">
                    {form.formState.errors.address.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  {...form.register('notes')}
                  placeholder="Additional notes about this client..."
                  rows={3}
                />
                {form.formState.errors.notes && (
                  <p className="text-sm text-red-600">
                    {form.formState.errors.notes.message}
                  </p>
                )}
              </div>
              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createClient.isPending}>
                  {createClient.isPending ? 'Creating...' : 'Create Client'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search clients by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2 mt-2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3 mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : clients && clients.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {clients.map((client) => (
            <Card
              key={client.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => handleCardClick(client.id)}
            >
              <CardHeader>
                <CardTitle className="text-lg">
                  {client.first_name} {client.last_name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {client.email && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Mail className="h-4 w-4" />
                    <span className="truncate">{client.email}</span>
                  </div>
                )}
                {client.phone && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Phone className="h-4 w-4" />
                    <span>{client.phone}</span>
                  </div>
                )}
                {client.address && (
                  <div className="flex items-start gap-2 text-sm text-gray-600">
                    <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span className="line-clamp-2">{client.address}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-gray-500" />
              <CardTitle>Client List</CardTitle>
            </div>
            <CardDescription>
              {search ? 'No clients match your search' : 'No clients added yet'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Users className="h-12 w-12 text-gray-400 mb-4" />
              <p className="text-gray-600 mb-4">
                {search
                  ? 'Try a different search term'
                  : "You don't have any clients yet."}
              </p>
              {!search && (
                <Button onClick={() => setIsDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Your First Client
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
