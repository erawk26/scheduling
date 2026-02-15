# KE Agenda UI/UX Patterns Guide

> Best practices and patterns for building consistent user interfaces

## 🎯 Core UX Principles

### 1. Local-First Feedback
- **Instant Updates**: Never show loading spinners for local operations
- **Optimistic UI**: Update UI immediately, sync in background
- **Offline Indicators**: Subtle, non-blocking offline status
- **Sync Feedback**: Small, unobtrusive sync status indicators

### 2. Mobile Service Professional Focus
- **One-Handed Operation**: Critical actions reachable with thumb
- **Glanceable Information**: Key data visible without scrolling
- **Quick Actions**: Common tasks accessible in 2 taps or less
- **Offline-First**: Full functionality without connection

## 📱 Mobile Patterns

### Touch-Optimized Interfaces
```tsx
/* Minimum Touch Target: 44x44px */
<Button className="min-h-[44px] px-6">
  Schedule Appointment
</Button>

/* Thumb-Friendly Bottom Actions */
<div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t safe-bottom">
  <Button className="w-full" size="lg">
    Primary Action
  </Button>
</div>

/* Swipe Gestures */
<div className="touch-pan-y">
  {appointments.map(apt => (
    <SwipeableCard
      onSwipeLeft={() => handleReschedule(apt)}
      onSwipeRight={() => handleComplete(apt)}
    >
      {/* Card content */}
    </SwipeableCard>
  ))}
</div>
```

### Mobile Navigation Patterns

#### Bottom Tab Navigation
```tsx
<nav className="fixed bottom-0 inset-x-0 bg-white border-t md:hidden safe-bottom">
  <div className="grid grid-cols-5">
    {tabs.map(tab => (
      <button
        key={tab.id}
        className={cn(
          "flex flex-col items-center justify-center py-2",
          isActive(tab) ? "text-blue-600" : "text-gray-600"
        )}
      >
        <tab.icon className="w-5 h-5" />
        <span className="text-xs mt-1">{tab.label}</span>
        {tab.badge && (
          <div className="absolute top-1 right-4 w-2 h-2 bg-red-500 rounded-full" />
        )}
      </button>
    ))}
  </div>
</nav>
```

#### Pull-to-Refresh
```tsx
<div 
  className="relative"
  onTouchStart={handleTouchStart}
  onTouchMove={handleTouchMove}
  onTouchEnd={handleTouchEnd}
>
  {isPulling && (
    <div className="absolute top-0 left-0 right-0 flex justify-center py-4">
      <RefreshCw className={cn(
        "w-5 h-5 text-gray-400",
        isRefreshing && "animate-spin"
      )} />
    </div>
  )}
  <div className={cn(
    "transition-transform",
    isPulling && "translate-y-12"
  )}>
    {/* Content */}
  </div>
</div>
```

## 🎨 Visual Hierarchy

### Information Architecture
```tsx
/* Primary Information */
<div className="space-y-6">
  {/* Most Important - Large, Bold */}
  <div>
    <h1 className="text-2xl font-bold text-gray-900">
      Today's Schedule
    </h1>
    <p className="text-3xl font-bold text-blue-600">
      8 Appointments
    </p>
  </div>

  {/* Secondary Information - Medium Size */}
  <div className="grid grid-cols-2 gap-4">
    <div>
      <p className="text-sm text-gray-600">Next Appointment</p>
      <p className="text-lg font-semibold">2:00 PM</p>
    </div>
    <div>
      <p className="text-sm text-gray-600">Travel Time</p>
      <p className="text-lg font-semibold">15 min</p>
    </div>
  </div>

  {/* Supporting Details - Small, Muted */}
  <div className="text-xs text-gray-500">
    Last synced 2 minutes ago
  </div>
</div>
```

### Color Usage Patterns
```tsx
/* Status Colors */
const statusColors = {
  confirmed: "bg-green-100 text-green-800 border-green-200",
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  cancelled: "bg-red-100 text-red-800 border-red-200",
  completed: "bg-blue-100 text-blue-800 border-blue-200",
}

/* Priority Indicators */
const priorityColors = {
  high: "border-l-4 border-red-500",
  medium: "border-l-4 border-yellow-500",
  low: "border-l-4 border-gray-300",
}

/* Interactive States */
const interactiveStates = {
  default: "bg-white hover:bg-gray-50",
  selected: "bg-blue-50 border-blue-500",
  disabled: "bg-gray-100 opacity-50 cursor-not-allowed",
}
```

## 🔄 Loading & Feedback Patterns

### Skeleton Loading
```tsx
const AppointmentSkeleton = () => (
  <Card>
    <CardHeader>
      <div className="flex items-center space-x-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
    </CardHeader>
    <CardContent>
      <div className="space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-3/4" />
      </div>
    </CardContent>
  </Card>
)
```

### Progress Indicators
```tsx
/* Multi-Step Process */
<div className="space-y-4">
  <div className="flex items-center justify-between">
    <h3 className="font-medium">Setting up appointment</h3>
    <span className="text-sm text-gray-500">Step {currentStep} of {totalSteps}</span>
  </div>
  
  <div className="flex items-center space-x-2">
    {steps.map((step, index) => (
      <React.Fragment key={step.id}>
        <div className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center text-sm",
          index < currentStep ? "bg-blue-600 text-white" :
          index === currentStep ? "bg-blue-100 text-blue-600 ring-2 ring-blue-600" :
          "bg-gray-200 text-gray-500"
        )}>
          {index < currentStep ? <Check className="w-4 h-4" /> : index + 1}
        </div>
        {index < steps.length - 1 && (
          <div className={cn(
            "flex-1 h-1",
            index < currentStep ? "bg-blue-600" : "bg-gray-200"
          )} />
        )}
      </React.Fragment>
    ))}
  </div>
</div>
```

### Toast Notifications
```tsx
/* Success Toast */
<div className="fixed bottom-4 right-4 z-50 animate-slide-up">
  <div className="bg-white rounded-lg shadow-lg border p-4 flex items-start space-x-3 max-w-sm">
    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
    <div className="flex-1">
      <p className="font-medium text-gray-900">Appointment saved</p>
      <p className="text-sm text-gray-600">Will sync when online</p>
    </div>
    <button onClick={dismiss}>
      <X className="w-4 h-4 text-gray-400" />
    </button>
  </div>
</div>
```

## 📊 Data Visualization

### Charts & Graphs
```tsx
/* Mini Chart in Card */
<Card>
  <CardHeader className="pb-2">
    <CardTitle className="text-sm font-medium">
      Weekly Overview
    </CardTitle>
  </CardHeader>
  <CardContent>
    <div className="h-[100px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={weekData}>
          <defs>
            <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="appointments"
            stroke="#3B82F6"
            fill="url(#colorGradient)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  </CardContent>
</Card>
```

### Status Indicators
```tsx
/* Connection Status */
<div className="flex items-center space-x-2">
  <div className={cn(
    "w-2 h-2 rounded-full",
    isOnline ? "bg-green-500 animate-pulse" : "bg-gray-400"
  )} />
  <span className="text-sm text-gray-600">
    {isOnline ? "Connected" : "Offline Mode"}
  </span>
</div>

/* Sync Status */
<div className="flex items-center space-x-3 p-2 bg-blue-50 rounded-lg">
  <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />
  <div className="flex-1">
    <p className="text-sm font-medium text-blue-900">Syncing...</p>
    <p className="text-xs text-blue-700">3 of 10 items</p>
  </div>
  <Progress value={30} className="w-20 h-2" />
</div>
```

## 🎭 Micro-Interactions

### Button Interactions
```tsx
/* Ripple Effect */
<Button
  className="relative overflow-hidden"
  onClick={(e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const ripple = document.createElement('span')
    ripple.className = 'absolute bg-white/30 rounded-full animate-ripple'
    ripple.style.left = `${e.clientX - rect.left}px`
    ripple.style.top = `${e.clientY - rect.top}px`
    e.currentTarget.appendChild(ripple)
    setTimeout(() => ripple.remove(), 600)
  }}
>
  Click Me
</Button>

/* Long Press Action */
<Button
  onMouseDown={startLongPress}
  onMouseUp={cancelLongPress}
  onTouchStart={startLongPress}
  onTouchEnd={cancelLongPress}
  className={cn(
    "transition-all",
    isLongPressing && "scale-95 bg-red-600"
  )}
>
  Hold to Delete
</Button>
```

### Form Interactions
```tsx
/* Field Focus Animation */
<div className="relative">
  <Input
    className="peer pt-6"
    placeholder=" "
    onFocus={() => setIsFocused(true)}
    onBlur={() => setIsFocused(false)}
  />
  <Label className={cn(
    "absolute left-3 transition-all",
    isFocused || value
      ? "top-2 text-xs text-blue-600"
      : "top-4 text-base text-gray-500"
  )}>
    Email Address
  </Label>
</div>

/* Live Validation */
<div className="space-y-2">
  <Input
    value={email}
    onChange={(e) => {
      setEmail(e.target.value)
      validateEmail(e.target.value)
    }}
    className={cn(
      errors.email && "border-red-500 focus:ring-red-500"
    )}
  />
  {errors.email && (
    <motion.p
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-sm text-red-600 flex items-center space-x-1"
    >
      <AlertCircle className="w-3 h-3" />
      <span>{errors.email}</span>
    </motion.p>
  )}
</div>
```

## 🎯 Empty States

### Contextual Empty States
```tsx
const EmptyState = ({ type }) => {
  const configs = {
    appointments: {
      icon: Calendar,
      title: "No appointments scheduled",
      description: "Your calendar is clear for today",
      action: "Schedule Appointment",
      actionIcon: Plus,
    },
    clients: {
      icon: Users,
      title: "No clients yet",
      description: "Start building your client base",
      action: "Add First Client",
      actionIcon: UserPlus,
    },
    search: {
      icon: Search,
      title: "No results found",
      description: "Try adjusting your search terms",
      action: "Clear Search",
      actionIcon: X,
    },
  }

  const config = configs[type]

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
        <config.icon className="w-8 h-8 text-gray-400" />
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-2">
        {config.title}
      </h3>
      <p className="text-sm text-gray-600 text-center mb-6 max-w-sm">
        {config.description}
      </p>
      <Button>
        <config.actionIcon className="w-4 h-4 mr-2" />
        {config.action}
      </Button>
    </div>
  )
}
```

## 🔒 Security Patterns

### Sensitive Data Display
```tsx
/* Masked Information */
<div className="flex items-center space-x-2">
  <span className="font-mono">
    {showFullNumber ? phoneNumber : `***-***-${phoneNumber.slice(-4)}`}
  </span>
  <Button
    variant="ghost"
    size="sm"
    onClick={() => setShowFullNumber(!showFullNumber)}
  >
    {showFullNumber ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
  </Button>
</div>

/* Confirmation for Destructive Actions */
<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button variant="destructive">Delete All Data</Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
      <AlertDialogDescription>
        This action cannot be undone. This will permanently delete all your local data.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <div className="my-4">
      <Label htmlFor="confirm">Type "DELETE" to confirm</Label>
      <Input
        id="confirm"
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        placeholder="Type DELETE"
      />
    </div>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction
        disabled={confirmText !== 'DELETE'}
        className="bg-red-600 hover:bg-red-700"
      >
        Delete Everything
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

## ♿ Accessibility Patterns

### Focus Management
```tsx
/* Skip Links */
<a
  href="#main-content"
  className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 z-50 px-4 py-2 bg-blue-600 text-white rounded"
>
  Skip to main content
</a>

/* Focus Trap in Modal */
<Dialog>
  <DialogContent onOpenAutoFocus={(e) => {
    // Focus first interactive element
    const firstInput = e.currentTarget.querySelector('input, button')
    firstInput?.focus()
  }}>
    {/* Modal content */}
  </DialogContent>
</Dialog>

/* Keyboard Navigation */
<div
  role="listbox"
  onKeyDown={(e) => {
    switch(e.key) {
      case 'ArrowDown':
        focusNext()
        break
      case 'ArrowUp':
        focusPrevious()
        break
      case 'Enter':
        selectCurrent()
        break
      case 'Escape':
        close()
        break
    }
  }}
>
  {items.map((item, index) => (
    <div
      key={item.id}
      role="option"
      tabIndex={index === focusedIndex ? 0 : -1}
      aria-selected={index === selectedIndex}
    >
      {item.label}
    </div>
  ))}
</div>
```

### Screen Reader Support
```tsx
/* Live Regions */
<div aria-live="polite" aria-atomic="true" className="sr-only">
  {syncStatus === 'syncing' && 'Syncing your data...'}
  {syncStatus === 'complete' && 'Sync complete'}
  {syncStatus === 'error' && 'Sync failed, will retry'}
</div>

/* Descriptive Labels */
<Button
  aria-label="Delete appointment for John Doe at 2:00 PM"
  title="Delete appointment"
>
  <Trash2 className="w-4 h-4" />
</Button>

/* Form Errors */
<div className="space-y-2">
  <Input
    aria-invalid={!!errors.email}
    aria-describedby={errors.email ? "email-error" : undefined}
  />
  {errors.email && (
    <p id="email-error" role="alert" className="text-sm text-red-600">
      {errors.email}
    </p>
  )}
</div>
```

---

These UI/UX patterns ensure a consistent, accessible, and delightful user experience across the entire KE Agenda application, optimized for mobile service professionals working in the field.