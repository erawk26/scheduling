# KE Agenda Component Library

> Complete component specifications using shadcn/ui and Tailwind CSS v4

## 📦 Core Components

### Authentication Components

#### SignInForm
```tsx
interface SignInFormProps {
  onSuccess?: () => void;
  redirectTo?: string;
}

<Card className="w-full max-w-md mx-auto">
  <CardHeader className="space-y-1">
    <CardTitle className="text-2xl font-bold">Welcome back</CardTitle>
    <CardDescription>
      Sign in to your account to continue
    </CardDescription>
  </CardHeader>
  <CardContent className="space-y-4">
    <div className="space-y-2">
      <Label htmlFor="email">Email</Label>
      <Input
        id="email"
        type="email"
        placeholder="john@example.com"
        required
      />
    </div>
    <div className="space-y-2">
      <Label htmlFor="password">Password</Label>
      <div className="relative">
        <Input
          id="password"
          type={showPassword ? "text" : "password"}
          required
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="absolute right-0 top-0 h-full px-3"
        >
          {showPassword ? <EyeOff /> : <Eye />}
        </Button>
      </div>
    </div>
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-2">
        <Checkbox id="remember" />
        <Label htmlFor="remember" className="text-sm cursor-pointer">
          Remember me
        </Label>
      </div>
      <Link href="/reset-password" className="text-sm text-blue-600 hover:underline">
        Forgot password?
      </Link>
    </div>
  </CardContent>
  <CardFooter className="flex flex-col space-y-3">
    <Button className="w-full" size="lg">
      Sign In
    </Button>
    <p className="text-sm text-center text-gray-600">
      Don't have an account?{" "}
      <Link href="/sign-up" className="text-blue-600 hover:underline">
        Sign up
      </Link>
    </p>
  </CardFooter>
</Card>
```

### Navigation Components

#### MainNavigation
```tsx
interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType;
  badge?: number;
}

<nav className="bg-white border-b border-gray-200">
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div className="flex justify-between h-16">
      {/* Logo */}
      <div className="flex items-center">
        <Link href="/dashboard" className="flex items-center space-x-3">
          <Calendar className="w-8 h-8 text-blue-600" />
          <span className="text-xl font-bold text-gray-900">KE Agenda</span>
        </Link>
      </div>
      
      {/* Desktop Navigation */}
      <div className="hidden md:flex items-center space-x-8">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center space-x-2 text-sm font-medium transition-colors",
              pathname === item.href
                ? "text-blue-600"
                : "text-gray-700 hover:text-blue-600"
            )}
          >
            <item.icon className="w-4 h-4" />
            <span>{item.label}</span>
            {item.badge && (
              <Badge variant="secondary" className="ml-1">
                {item.badge}
              </Badge>
            )}
          </Link>
        ))}
      </div>
      
      {/* Mobile Menu Button */}
      <div className="md:hidden flex items-center">
        <Button variant="ghost" size="sm" onClick={toggleMobileMenu}>
          <Menu className="w-6 h-6" />
        </Button>
      </div>
    </div>
  </div>
  
  {/* Mobile Navigation */}
  <AnimatePresence>
    {isMobileMenuOpen && (
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: "auto", opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        className="md:hidden border-t border-gray-200"
      >
        <div className="px-4 py-2 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center space-x-3 px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-50"
            >
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
      </motion.div>
    )}
  </AnimatePresence>
</nav>
```

### Dashboard Components

#### StatCard
```tsx
interface StatCardProps {
  title: string;
  value: string | number;
  change?: {
    value: number;
    label: string;
  };
  icon: React.ComponentType;
  trend?: 'up' | 'down' | 'neutral';
}

<Card>
  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
    <CardTitle className="text-sm font-medium text-gray-600">
      {title}
    </CardTitle>
    <div className="p-2 bg-blue-100 rounded-lg">
      <Icon className="w-4 h-4 text-blue-600" />
    </div>
  </CardHeader>
  <CardContent>
    <div className="text-2xl font-bold">{value}</div>
    {change && (
      <div className="flex items-center space-x-1 text-xs">
        {trend === 'up' ? (
          <TrendingUp className="w-3 h-3 text-green-500" />
        ) : trend === 'down' ? (
          <TrendingDown className="w-3 h-3 text-red-500" />
        ) : (
          <Minus className="w-3 h-3 text-gray-400" />
        )}
        <span className={cn(
          "font-medium",
          trend === 'up' && "text-green-600",
          trend === 'down' && "text-red-600",
          trend === 'neutral' && "text-gray-600"
        )}>
          {change.value > 0 ? '+' : ''}{change.value}
        </span>
        <span className="text-gray-500">{change.label}</span>
      </div>
    )}
  </CardContent>
</Card>
```

### Calendar Components

#### AppointmentCalendar
```tsx
interface CalendarProps {
  view: 'week' | 'month' | 'day';
  appointments: Appointment[];
  onDateSelect?: (date: Date) => void;
  onAppointmentClick?: (appointment: Appointment) => void;
}

<Card className="w-full">
  <CardHeader>
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-4">
        <Button variant="outline" size="sm" onClick={previousPeriod}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <h2 className="text-lg font-semibold">
          {format(currentDate, 'MMMM yyyy')}
        </h2>
        <Button variant="outline" size="sm" onClick={nextPeriod}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
      <div className="flex items-center space-x-2">
        <Button
          variant={view === 'day' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setView('day')}
        >
          Day
        </Button>
        <Button
          variant={view === 'week' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setView('week')}
        >
          Week
        </Button>
        <Button
          variant={view === 'month' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setView('month')}
        >
          Month
        </Button>
      </div>
    </div>
  </CardHeader>
  <CardContent className="p-0">
    <div className="grid grid-cols-7 border-t">
      {/* Calendar Header */}
      {weekDays.map(day => (
        <div key={day} className="p-2 text-xs font-medium text-gray-600 text-center border-r last:border-r-0">
          {day}
        </div>
      ))}
      
      {/* Calendar Grid */}
      {calendarDays.map((week, weekIndex) => (
        <React.Fragment key={weekIndex}>
          {week.map((day, dayIndex) => (
            <div
              key={dayIndex}
              className={cn(
                "min-h-[100px] p-2 border-r border-b last:border-r-0",
                !day.isCurrentMonth && "bg-gray-50",
                day.isToday && "bg-blue-50",
                day.hasAppointments && "cursor-pointer hover:bg-gray-50"
              )}
              onClick={() => onDateSelect?.(day.date)}
            >
              <div className="font-medium text-sm mb-1">
                {format(day.date, 'd')}
              </div>
              <div className="space-y-1">
                {day.appointments.slice(0, 3).map((apt, idx) => (
                  <div
                    key={idx}
                    className="text-xs p-1 bg-blue-100 text-blue-700 rounded truncate cursor-pointer hover:bg-blue-200"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAppointmentClick?.(apt);
                    }}
                  >
                    {format(apt.startTime, 'h:mm a')} - {apt.clientName}
                  </div>
                ))}
                {day.appointments.length > 3 && (
                  <div className="text-xs text-gray-500">
                    +{day.appointments.length - 3} more
                  </div>
                )}
              </div>
            </div>
          ))}
        </React.Fragment>
      ))}
    </div>
  </CardContent>
</Card>
```

### Form Components

#### AppointmentForm
```tsx
interface AppointmentFormProps {
  appointment?: Appointment;
  clients: Client[];
  services: Service[];
  onSubmit: (data: AppointmentData) => void;
}

<form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
  {/* Client Selection */}
  <div className="space-y-2">
    <Label htmlFor="client">Client *</Label>
    <Select value={clientId} onValueChange={setClientId}>
      <SelectTrigger>
        <SelectValue placeholder="Select a client" />
      </SelectTrigger>
      <SelectContent>
        {clients.map(client => (
          <SelectItem key={client.id} value={client.id}>
            <div className="flex items-center space-x-2">
              <Avatar className="w-6 h-6">
                <AvatarFallback className="text-xs">
                  {client.initials}
                </AvatarFallback>
              </Avatar>
              <span>{client.name}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
    {errors.client && (
      <p className="text-sm text-red-600">{errors.client.message}</p>
    )}
  </div>

  {/* Service Selection */}
  <div className="space-y-2">
    <Label htmlFor="service">Service *</Label>
    <Select value={serviceId} onValueChange={setServiceId}>
      <SelectTrigger>
        <SelectValue placeholder="Select a service" />
      </SelectTrigger>
      <SelectContent>
        {services.map(service => (
          <SelectItem key={service.id} value={service.id}>
            <div className="flex items-center justify-between w-full">
              <span>{service.name}</span>
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <Clock className="w-3 h-3" />
                <span>{service.duration}m</span>
                <span>•</span>
                <span>${service.price}</span>
              </div>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>

  {/* Date & Time */}
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div className="space-y-2">
      <Label htmlFor="date">Date *</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal",
              !date && "text-gray-500"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date ? format(date, "PPP") : "Pick a date"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0">
          <Calendar
            mode="single"
            selected={date}
            onSelect={setDate}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>

    <div className="space-y-2">
      <Label htmlFor="time">Time *</Label>
      <Select value={time} onValueChange={setTime}>
        <SelectTrigger>
          <SelectValue placeholder="Select time" />
        </SelectTrigger>
        <SelectContent>
          {timeSlots.map(slot => (
            <SelectItem 
              key={slot} 
              value={slot}
              disabled={isSlotConflicted(slot)}
            >
              {slot}
              {isSlotConflicted(slot) && (
                <span className="ml-2 text-xs text-red-600">Conflict</span>
              )}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  </div>

  {/* Location */}
  <div className="space-y-2">
    <Label htmlFor="address">Address</Label>
    <div className="relative">
      <MapPin className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
      <Textarea
        id="address"
        placeholder="123 Main St, City, State ZIP"
        className="pl-10"
        rows={2}
      />
    </div>
  </div>

  {/* Notes */}
  <div className="space-y-2">
    <Label htmlFor="notes">Notes</Label>
    <Textarea
      id="notes"
      placeholder="Special instructions or notes..."
      rows={3}
    />
  </div>

  {/* Weather Alert */}
  {showWeatherAlert && (
    <Alert className="border-amber-200 bg-amber-50">
      <Cloud className="h-4 w-4 text-amber-600" />
      <AlertTitle className="text-amber-800">Weather Alert</AlertTitle>
      <AlertDescription className="text-amber-700">
        Rain expected on this date. This service is weather-dependent.
        Consider rescheduling or confirming with the client.
      </AlertDescription>
    </Alert>
  )}

  {/* Actions */}
  <div className="flex justify-end space-x-3">
    <Button type="button" variant="outline" onClick={onCancel}>
      Cancel
    </Button>
    <Button type="submit" disabled={isSubmitting}>
      {isSubmitting ? (
        <>
          <Loader className="w-4 h-4 mr-2 animate-spin" />
          Saving...
        </>
      ) : (
        <>
          <Save className="w-4 h-4 mr-2" />
          Save Appointment
        </>
      )}
    </Button>
  </div>
</form>
```

### List Components

#### ClientList
```tsx
interface ClientListProps {
  clients: Client[];
  onClientClick?: (client: Client) => void;
  onEdit?: (client: Client) => void;
  onDelete?: (client: Client) => void;
}

<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {clients.map(client => (
    <Card 
      key={client.id}
      className="hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => onClientClick?.(client)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <Avatar>
              <AvatarFallback className="bg-blue-500 text-white">
                {client.initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-base">
                {client.firstName} {client.lastName}
              </CardTitle>
              <CardDescription className="text-xs">
                {client.petCount} pet{client.petCount !== 1 ? 's' : ''}
              </CardDescription>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit?.(client)}>
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Calendar className="w-4 h-4 mr-2" />
                Schedule
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                className="text-red-600"
                onClick={() => onDelete?.(client)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Contact Info */}
        <div className="space-y-2 text-sm">
          {client.phone && (
            <div className="flex items-center space-x-2 text-gray-600">
              <Phone className="w-3 h-3" />
              <a href={`tel:${client.phone}`} className="hover:text-blue-600">
                {formatPhone(client.phone)}
              </a>
            </div>
          )}
          {client.email && (
            <div className="flex items-center space-x-2 text-gray-600">
              <Mail className="w-3 h-3" />
              <a href={`mailto:${client.email}`} className="hover:text-blue-600 truncate">
                {client.email}
              </a>
            </div>
          )}
          {client.address && (
            <div className="flex items-start space-x-2 text-gray-600">
              <MapPin className="w-3 h-3 mt-0.5" />
              <span className="text-xs">{client.address}</span>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="pt-3 border-t flex justify-between text-xs text-gray-500">
          <span>Since {format(client.createdAt, 'MMM yyyy')}</span>
          <span>Last: {client.lastAppointment ? format(client.lastAppointment, 'MMM d') : 'Never'}</span>
        </div>
      </CardContent>
    </Card>
  ))}
</div>
```

### Modal Components

#### ConfirmationDialog
```tsx
interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'destructive';
}

<AlertDialog open={isOpen} onOpenChange={onClose}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>{title}</AlertDialogTitle>
      <AlertDialogDescription>
        {description}
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>
        {cancelLabel || 'Cancel'}
      </AlertDialogCancel>
      <AlertDialogAction
        className={cn(
          variant === 'destructive' && "bg-red-600 hover:bg-red-700"
        )}
        onClick={onConfirm}
      >
        {confirmLabel || 'Confirm'}
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

### Data Export Components

#### ExportDialog
```tsx
interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (options: ExportOptions) => void;
}

<Dialog open={isOpen} onOpenChange={onClose}>
  <DialogContent className="sm:max-w-md">
    <DialogHeader>
      <DialogTitle>Export Data</DialogTitle>
      <DialogDescription>
        Download your data in various formats
      </DialogDescription>
    </DialogHeader>
    <div className="space-y-4">
      {/* Export Options */}
      <div className="space-y-3">
        <Label>Select data to export</Label>
        <div className="space-y-2">
          {exportOptions.map(option => (
            <div key={option.id} className="flex items-center space-x-2">
              <Checkbox
                id={option.id}
                checked={selectedOptions.includes(option.id)}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setSelectedOptions([...selectedOptions, option.id])
                  } else {
                    setSelectedOptions(selectedOptions.filter(id => id !== option.id))
                  }
                }}
              />
              <Label htmlFor={option.id} className="flex-1 cursor-pointer">
                <div className="font-medium">{option.label}</div>
                <div className="text-xs text-gray-500">{option.count} records</div>
              </Label>
            </div>
          ))}
        </div>
      </div>

      {/* Format Selection */}
      <div className="space-y-2">
        <Label>Export format</Label>
        <RadioGroup value={format} onValueChange={setFormat}>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="json" id="json" />
            <Label htmlFor="json">JSON</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="csv" id="csv" />
            <Label htmlFor="csv">CSV</Label>
          </div>
        </RadioGroup>
      </div>

      {/* Date Range */}
      <div className="space-y-2">
        <Label>Date range (optional)</Label>
        <div className="grid grid-cols-2 gap-2">
          <Input type="date" placeholder="Start date" />
          <Input type="date" placeholder="End date" />
        </div>
      </div>

      {/* Progress */}
      {isExporting && (
        <div className="space-y-2">
          <Progress value={exportProgress} />
          <p className="text-xs text-center text-gray-500">
            Exporting... {exportProgress}%
          </p>
        </div>
      )}
    </div>
    <DialogFooter>
      <Button variant="outline" onClick={onClose}>
        Cancel
      </Button>
      <Button onClick={handleExport} disabled={isExporting || selectedOptions.length === 0}>
        <Download className="w-4 h-4 mr-2" />
        Export
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

## 🎨 Theme Configuration

### Tailwind Config (v4)
```js
// tailwind.config.js
export default {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', ...fontFamily.sans],
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
```

---

This component library provides a complete set of reusable, accessible, and performant components for the KE Agenda application, all built with shadcn/ui and Tailwind CSS v4.