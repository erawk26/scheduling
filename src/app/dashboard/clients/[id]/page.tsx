import { useState } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import { useClient, useUpdateClient, useDeleteClient } from '@/hooks/use-clients';
import { usePets, useCreatePet, useUpdatePet, useDeletePet } from '@/hooks/use-pets';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { clientSchema, petSchema, type ClientFormData, type PetFormData } from '@/lib/validations';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Mail, Phone, MapPin, Pencil, Trash2, Plus, Users } from 'lucide-react';

export default function ClientDetailPage() {
  const navigate = useNavigate();
  const { id: clientId } = useParams({ from: '/dashboard/clients/$id' });

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAddPetDialogOpen, setIsAddPetDialogOpen] = useState(false);
  const [editingPet, setEditingPet] = useState<string | null>(null);

  const { data: client, isLoading: isLoadingClient } = useClient(clientId);
  const { data: pets, isLoading: isLoadingPets } = usePets(clientId);
  const updateClient = useUpdateClient();
  const deleteClient = useDeleteClient();
  const createPet = useCreatePet();
  const updatePet = useUpdatePet();
  const deletePet = useDeletePet();

  const clientForm = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema as any),
    defaultValues: {
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      address: '',
      notes: '',
    },
  });

  const petForm = useForm<PetFormData>({
    resolver: zodResolver(petSchema as any),
    defaultValues: {
      name: '',
      species: 'dog',
      breed: '',
      size: undefined,
      age_years: undefined,
      weight_lbs: undefined,
      behavior_notes: '',
      medical_notes: '',
    },
  });

  const handleEditClient = () => {
    if (client) {
      clientForm.reset({
        first_name: client.first_name,
        last_name: client.last_name,
        email: client.email || '',
        phone: client.phone || '',
        address: client.address || '',
        notes: client.notes || '',
        scheduling_flexibility: client.scheduling_flexibility || 'unknown',
      });
      setIsEditDialogOpen(true);
    }
  };

  const onSubmitClientEdit = async (data: ClientFormData) => {
    try {
      await updateClient.mutateAsync({ id: clientId, data });
      setIsEditDialogOpen(false);
    } catch (error) {
      console.error('Failed to update client:', error);
    }
  };

  const handleDeleteClient = async () => {
    try {
      await deleteClient.mutateAsync(clientId);
      navigate({ to: '/dashboard/clients' });
    } catch (error) {
      console.error('Failed to delete client:', error);
    }
  };

  const onSubmitPet = async (data: PetFormData) => {
    try {
      if (editingPet) {
        await updatePet.mutateAsync({ id: editingPet, data });
        setEditingPet(null);
      } else {
        await createPet.mutateAsync({ ...data, client_id: clientId });
      }
      petForm.reset();
      setIsAddPetDialogOpen(false);
    } catch (error) {
      console.error('Failed to save pet:', error);
    }
  };

  const handleEditPet = (pet: any) => {
    petForm.reset({
      name: pet.name,
      species: pet.species,
      breed: pet.breed || '',
      size: pet.size || undefined,
      age_years: pet.age_years || undefined,
      weight_lbs: pet.weight_lbs || undefined,
      behavior_notes: pet.behavior_notes || '',
      medical_notes: pet.medical_notes || '',
    });
    setEditingPet(pet.id);
    setIsAddPetDialogOpen(true);
  };

  const handleDeletePet = async (petId: string) => {
    try {
      await deletePet.mutateAsync(petId);
    } catch (error) {
      console.error('Failed to delete pet:', error);
    }
  };

  const handleClosePetDialog = () => {
    setIsAddPetDialogOpen(false);
    setEditingPet(null);
    petForm.reset();
  };

  if (isLoadingClient) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-1/3" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-3/4" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="space-y-6">
        <Button onClick={() => navigate({ to: '/dashboard/clients' })} variant="outline">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Clients
        </Button>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-600">Client not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button onClick={() => navigate({ to: '/dashboard/clients' })} variant="outline">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Clients
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-2xl">
                  {client.first_name} {client.last_name}
                </CardTitle>
                {client.scheduling_flexibility === 'flexible' && (
                  <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Flexible</Badge>
                )}
                {client.scheduling_flexibility === 'fixed' && (
                  <Badge variant="outline" className="text-gray-500">Fixed</Badge>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleEditClient}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Client</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete {client.first_name} {client.last_name}?
                      This action cannot be undone and will also delete all associated pets.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteClient}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {client.email && (
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-gray-400" />
              <span className="text-gray-700">{client.email}</span>
            </div>
          )}
          {client.phone && (
            <div className="flex items-center gap-3">
              <Phone className="h-5 w-5 text-gray-400" />
              <span className="text-gray-700">{client.phone}</span>
            </div>
          )}
          {client.address && (
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
              <span className="text-gray-700">{client.address}</span>
            </div>
          )}
          {client.notes && (
            <div className="pt-4 border-t">
              <h4 className="font-medium text-gray-900 mb-2">Notes</h4>
              <p className="text-gray-700 whitespace-pre-wrap">{client.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Pets</CardTitle>
              <CardDescription>
                {pets && pets.length > 0
                  ? `${pets.length} pet${pets.length !== 1 ? 's' : ''}`
                  : 'No pets added yet'}
              </CardDescription>
            </div>
            <Dialog open={isAddPetDialogOpen} onOpenChange={(open) => {
              if (!open) handleClosePetDialog();
              else setIsAddPetDialogOpen(open);
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Pet
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingPet ? 'Edit Pet' : 'Add New Pet'}</DialogTitle>
                  <DialogDescription>
                    Enter pet information below
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={petForm.handleSubmit(onSubmitPet)} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="pet_name">Name *</Label>
                    <Input
                      id="pet_name"
                      {...petForm.register('name')}
                      placeholder="Buddy"
                    />
                    {petForm.formState.errors.name && (
                      <p className="text-sm text-red-600">
                        {petForm.formState.errors.name.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="species">Species *</Label>
                    <Select
                      value={petForm.watch('species')}
                      onValueChange={(value) => petForm.setValue('species', value as any)}
                    >
                      <SelectTrigger id="species">
                        <SelectValue placeholder="Select species" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dog">Dog</SelectItem>
                        <SelectItem value="cat">Cat</SelectItem>
                        <SelectItem value="bird">Bird</SelectItem>
                        <SelectItem value="rabbit">Rabbit</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    {petForm.formState.errors.species && (
                      <p className="text-sm text-red-600">
                        {petForm.formState.errors.species.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="breed">Breed</Label>
                    <Input
                      id="breed"
                      {...petForm.register('breed')}
                      placeholder="Golden Retriever"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="size">Size</Label>
                    <Select
                      value={petForm.watch('size') || ''}
                      onValueChange={(value) => petForm.setValue('size', value as any || undefined)}
                    >
                      <SelectTrigger id="size">
                        <SelectValue placeholder="Select size" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="tiny">Tiny</SelectItem>
                        <SelectItem value="small">Small</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="large">Large</SelectItem>
                        <SelectItem value="giant">Giant</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="age_years">Age (years)</Label>
                      <Input
                        id="age_years"
                        type="number"
                        step="0.1"
                        {...petForm.register('age_years', {
                          setValueAs: (v: string) => {
                            const n = parseFloat(v);
                            return isNaN(n) ? undefined : n;
                          },
                        })}
                        placeholder="3"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="weight_lbs">Weight (lbs)</Label>
                      <Input
                        id="weight_lbs"
                        type="number"
                        step="0.1"
                        {...petForm.register('weight_lbs', {
                          setValueAs: (v: string) => {
                            const n = parseFloat(v);
                            return isNaN(n) ? undefined : n;
                          },
                        })}
                        placeholder="65"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="behavior_notes">Behavior Notes</Label>
                    <Textarea
                      id="behavior_notes"
                      {...petForm.register('behavior_notes')}
                      placeholder="Friendly, energetic, good with kids..."
                      rows={2}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="medical_notes">Medical Notes</Label>
                    <Textarea
                      id="medical_notes"
                      {...petForm.register('medical_notes')}
                      placeholder="Allergies, medications, conditions..."
                      rows={2}
                    />
                  </div>
                  <div className="flex justify-end gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleClosePetDialog}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createPet.isPending || updatePet.isPending}>
                      {createPet.isPending || updatePet.isPending
                        ? 'Saving...'
                        : editingPet
                        ? 'Update Pet'
                        : 'Create Pet'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingPets ? (
            <div className="space-y-3">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="border rounded-lg p-4">
                  <Skeleton className="h-5 w-1/3" />
                  <Skeleton className="h-4 w-1/2 mt-2" />
                </div>
              ))}
            </div>
          ) : pets && pets.length > 0 ? (
            <div className="space-y-3">
              {pets.map((pet) => (
                <div
                  key={pet.id}
                  className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold text-lg">{pet.name}</h4>
                        <Badge variant="secondary" className="capitalize">
                          {pet.species}
                        </Badge>
                        {pet.size && (
                          <Badge variant="outline" className="capitalize">
                            {pet.size}
                          </Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                        {pet.breed && (
                          <div>
                            <span className="font-medium">Breed:</span> {pet.breed}
                          </div>
                        )}
                        {pet.age_years !== null && (
                          <div>
                            <span className="font-medium">Age:</span> {pet.age_years} years
                          </div>
                        )}
                        {pet.weight_lbs !== null && (
                          <div>
                            <span className="font-medium">Weight:</span> {pet.weight_lbs} lbs
                          </div>
                        )}
                      </div>
                      {pet.behavior_notes && (
                        <div className="mt-2 text-sm text-gray-600">
                          <span className="font-medium">Behavior:</span> {pet.behavior_notes}
                        </div>
                      )}
                      {pet.medical_notes && (
                        <div className="mt-2 text-sm text-gray-600">
                          <span className="font-medium">Medical:</span> {pet.medical_notes}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 ml-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditPet(pet)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Pet</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete {pet.name}? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeletePet(pet.id)}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="h-12 w-12 text-gray-400 mb-4" />
              <p className="text-gray-600 mb-4">No pets added yet</p>
              <Button onClick={() => setIsAddPetDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Pet
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Client</DialogTitle>
            <DialogDescription>
              Update client information below
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={clientForm.handleSubmit(onSubmitClientEdit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_first_name">First Name *</Label>
                <Input
                  id="edit_first_name"
                  autoComplete="given-name"
                  {...clientForm.register('first_name')}
                  placeholder="John"
                />
                {clientForm.formState.errors.first_name && (
                  <p className="text-sm text-red-600">
                    {clientForm.formState.errors.first_name.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_last_name">Last Name *</Label>
                <Input
                  id="edit_last_name"
                  autoComplete="family-name"
                  {...clientForm.register('last_name')}
                  placeholder="Doe"
                />
                {clientForm.formState.errors.last_name && (
                  <p className="text-sm text-red-600">
                    {clientForm.formState.errors.last_name.message}
                  </p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_email">Email</Label>
              <Input
                id="edit_email"
                type="email"
                autoComplete="email"
                {...clientForm.register('email')}
                placeholder="john.doe@example.com"
              />
              {clientForm.formState.errors.email && (
                <p className="text-sm text-red-600">
                  {clientForm.formState.errors.email.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_phone">Phone</Label>
              <Input
                id="edit_phone"
                autoComplete="tel"
                {...clientForm.register('phone')}
                placeholder="(555) 123-4567"
              />
              {clientForm.formState.errors.phone && (
                <p className="text-sm text-red-600">
                  {clientForm.formState.errors.phone.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_address">Address</Label>
              <Input
                id="edit_address"
                autoComplete="street-address"
                {...clientForm.register('address')}
                placeholder="123 Main St, City, State 12345"
              />
              {clientForm.formState.errors.address && (
                <p className="text-sm text-red-600">
                  {clientForm.formState.errors.address.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_notes">Notes</Label>
              <Textarea
                id="edit_notes"
                {...clientForm.register('notes')}
                placeholder="Additional notes about this client..."
                rows={3}
              />
              {clientForm.formState.errors.notes && (
                <p className="text-sm text-red-600">
                  {clientForm.formState.errors.notes.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_flexibility">Scheduling Flexibility</Label>
              <Select
                value={clientForm.watch('scheduling_flexibility') || 'unknown'}
                onValueChange={(value) => clientForm.setValue('scheduling_flexibility', value as 'unknown' | 'flexible' | 'fixed')}
              >
                <SelectTrigger id="edit_flexibility">
                  <SelectValue placeholder="Select flexibility" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unknown">Unknown</SelectItem>
                  <SelectItem value="flexible">Flexible</SelectItem>
                  <SelectItem value="fixed">Fixed</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                Flexible clients can be suggested for schedule optimization
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateClient.isPending}>
                {updateClient.isPending ? 'Updating...' : 'Update Client'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
