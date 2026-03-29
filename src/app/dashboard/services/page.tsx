import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Briefcase, Plus, Edit, Trash2, Clock, DollarSign, MapPin, CloudRain } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useServices, useCreateService, useUpdateService, useDeleteService } from '@/hooks/use-services';
import { serviceSchema, type ServiceFormData } from '@/lib/validations';
import type { Service } from '@/lib/offlinekit/schema';

export default function ServicesPage() {
  const { data: services, isLoading } = useServices();
  const createService = useCreateService();
  const updateService = useUpdateService();
  const deleteService = useDeleteService();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [deleteServiceId, setDeleteServiceId] = useState<string | null>(null);
  const [priceDisplay, setPriceDisplay] = useState('');

  const form = useForm<ServiceFormData>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      name: '',
      description: '',
      duration_minutes: 60,
      price_cents: null,
      weather_dependent: false,
      location_type: 'client_location',
    },
  });

  const handleOpenDialog = (service?: Service) => {
    if (service) {
      setEditingService(service);
      form.reset({
        name: service.name,
        description: service.description ?? '',
        duration_minutes: service.duration_minutes,
        price_cents: service.price_cents,
        weather_dependent: service.weather_dependent,
        location_type: service.location_type as 'client_location' | 'business_location' | 'mobile',
      });
      setPriceDisplay(
        service.price_cents != null ? (service.price_cents / 100).toFixed(2) : ''
      );
    } else {
      setEditingService(null);
      form.reset({
        name: '',
        description: '',
        duration_minutes: 60,
        price_cents: null,
        weather_dependent: false,
        location_type: 'client_location',
      });
      setPriceDisplay('');
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingService(null);
    setPriceDisplay('');
    form.reset();
  };

  const onSubmit = async (data: ServiceFormData) => {
    try {
      if (editingService) {
        await updateService.mutateAsync({ id: editingService.id, data });
      } else {
        await createService.mutateAsync(data);
      }
      handleCloseDialog();
    } catch (error) {
      console.error('Failed to save service:', error);
    }
  };

  const handleDelete = async () => {
    if (!deleteServiceId) return;
    try {
      await deleteService.mutateAsync(deleteServiceId);
      setDeleteServiceId(null);
    } catch (error) {
      console.error('Failed to delete service:', error);
    }
  };

  const formatPrice = (cents: number | null) => {
    if (cents === null) return 'Not set';
    return `$${(cents / 100).toFixed(2)}`;
  };

  const formatLocationLabel = (type: string) => {
    const labels: Record<string, string> = {
      client_location: 'Client Location',
      business_location: 'Business Location',
      mobile: 'Mobile',
    };
    return labels[type] || type;
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Services</h1>
          <p className="mt-2 text-gray-600">Manage services you offer</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-full mt-2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Services</h1>
          <p className="mt-2 text-gray-600">Manage services you offer</p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="w-4 h-4 mr-2" />
          Add Service
        </Button>
      </div>

      {!services || services.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Briefcase className="h-12 w-12 text-gray-300 mb-4" />
              <p className="text-gray-500 mb-4">
                Add the services you offer to start scheduling appointments.
              </p>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="w-4 h-4 mr-2" />
                Add Service
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <Card key={service.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{service.name}</CardTitle>
                    {service.description && (
                      <CardDescription className="mt-1">{service.description}</CardDescription>
                    )}
                  </div>
                  {service.weather_dependent && (
                    <CloudRain className="h-4 w-4 text-blue-500 ml-2" />
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Clock className="h-4 w-4" />
                  <span>{service.duration_minutes} minutes</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <DollarSign className="h-4 w-4" />
                  <span>{formatPrice(service.price_cents)}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <MapPin className="h-4 w-4" />
                  <span>{formatLocationLabel(service.location_type)}</span>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleOpenDialog(service)}
                  >
                    <Edit className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeleteServiceId(service.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={handleCloseDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogHeader>
              <DialogTitle>{editingService ? 'Edit Service' : 'Add Service'}</DialogTitle>
              <DialogDescription>
                {editingService ? 'Update service details.' : 'Create a new service offering.'}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  {...form.register('name')}
                  placeholder="e.g., Full Grooming"
                />
                {form.formState.errors.name && (
                  <p className="text-sm text-red-500">{form.formState.errors.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  {...form.register('description')}
                  placeholder="Brief description of the service"
                />
                {form.formState.errors.description && (
                  <p className="text-sm text-red-500">{form.formState.errors.description.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="duration">Duration (minutes) *</Label>
                  <Input
                    id="duration"
                    type="number"
                    step="15"
                    {...form.register('duration_minutes', { valueAsNumber: true })}
                  />
                  {form.formState.errors.duration_minutes && (
                    <p className="text-sm text-red-500">{form.formState.errors.duration_minutes.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="price">Price ($)</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={priceDisplay}
                    onChange={(e) => {
                      const value = e.target.value;
                      setPriceDisplay(value);
                      if (value === '') {
                        form.setValue('price_cents', null);
                      } else {
                        const dollars = parseFloat(value);
                        form.setValue('price_cents', isNaN(dollars) ? null : Math.round(dollars * 100));
                      }
                    }}
                  />
                  {form.formState.errors.price_cents && (
                    <p className="text-sm text-red-500">{form.formState.errors.price_cents.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Location Type *</Label>
                <Select
                  value={form.watch('location_type')}
                  onValueChange={(value) => form.setValue('location_type', value as any)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="client_location">Client Location</SelectItem>
                    <SelectItem value="business_location">Business Location</SelectItem>
                    <SelectItem value="mobile">Mobile</SelectItem>
                  </SelectContent>
                </Select>
                {form.formState.errors.location_type && (
                  <p className="text-sm text-red-500">{form.formState.errors.location_type.message}</p>
                )}
              </div>

              <div className="flex items-center justify-between space-x-2">
                <Label htmlFor="weather" className="flex-1">Weather Dependent</Label>
                <Switch
                  id="weather"
                  checked={form.watch('weather_dependent')}
                  onCheckedChange={(checked) => form.setValue('weather_dependent', checked)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Saving...' : editingService ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteServiceId} onOpenChange={() => setDeleteServiceId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Service</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this service? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
