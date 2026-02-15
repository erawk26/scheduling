# KE Agenda V3 Design System

> Comprehensive design guidelines using shadcn/ui components and Tailwind CSS v4

## 🎨 Design Philosophy

### Core Principles
1. **Local-First Visual Feedback** - Instant UI updates without loading states
2. **Professional & Trustworthy** - Clean, business-focused aesthetics
3. **Mobile-First Responsive** - Optimized for field service professionals on-the-go
4. **Accessibility First** - WCAG 2.1 AA compliant components
5. **Performance Optimized** - Minimal visual complexity for fast rendering

## 🎯 Visual Identity

### Brand Colors
```css
/* Primary - Professional Blue */
--primary: 217 91% 60%;        /* hsl(217, 91%, 60%) - #4F7FE3 */
--primary-foreground: 0 0% 98%; /* White text on primary */

/* Secondary - Neutral Gray */
--secondary: 220 14% 96%;       /* hsl(220, 14%, 96%) - #F3F4F6 */
--secondary-foreground: 220 9% 25%; /* Dark text on secondary */

/* Accent - Success Green */
--accent: 142 76% 36%;          /* hsl(142, 76%, 36%) - #16A34A */
--accent-foreground: 0 0% 98%;  /* White text on accent */

/* Semantic Colors */
--success: 142 76% 36%;         /* Green - #16A34A */
--warning: 38 92% 50%;          /* Amber - #F59E0B */
--error: 0 84% 60%;             /* Red - #EF4444 */
--info: 199 89% 48%;            /* Blue - #0EA5E9 */
```

### Typography Scale
```css
/* Font Family */
--font-sans: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
--font-mono: "SF Mono", Monaco, "Cascadia Code", monospace;

/* Font Sizes (Tailwind v4) */
--text-xs: 0.75rem;     /* 12px */
--text-sm: 0.875rem;    /* 14px */
--text-base: 1rem;      /* 16px */
--text-lg: 1.125rem;    /* 18px */
--text-xl: 1.25rem;     /* 20px */
--text-2xl: 1.5rem;     /* 24px */
--text-3xl: 1.875rem;   /* 30px */
--text-4xl: 2.25rem;    /* 36px */

/* Font Weights */
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;
```

### Spacing System
```css
/* Consistent spacing scale (rem) */
--space-0: 0;
--space-1: 0.25rem;  /* 4px */
--space-2: 0.5rem;   /* 8px */
--space-3: 0.75rem;  /* 12px */
--space-4: 1rem;     /* 16px */
--space-5: 1.25rem;  /* 20px */
--space-6: 1.5rem;   /* 24px */
--space-8: 2rem;     /* 32px */
--space-10: 2.5rem;  /* 40px */
--space-12: 3rem;    /* 48px */
--space-16: 4rem;    /* 64px */
```

## 🧩 Component Patterns

### Layout Components

#### App Shell
```tsx
<div className="min-h-screen bg-gray-50">
  {/* Header */}
  <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex justify-between items-center h-16">
        {/* Logo & Navigation */}
        <div className="flex items-center gap-8">
          <h1 className="text-xl font-bold text-gray-900">KE Agenda</h1>
          <nav className="hidden md:flex gap-6">
            {/* Navigation items */}
          </nav>
        </div>
        {/* User & Actions */}
        <div className="flex items-center gap-4">
          <Badge variant={isOnline ? "default" : "secondary"}>
            {isOnline ? "Online" : "Offline"}
          </Badge>
          <Button size="sm">Action</Button>
        </div>
      </div>
    </div>
  </header>
  
  {/* Main Content */}
  <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    {children}
  </main>
</div>
```

#### Dashboard Grid
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
  {/* Stat Cards */}
  <Card>
    <CardHeader className="pb-2">
      <CardTitle className="text-sm font-medium text-gray-600">
        Today's Appointments
      </CardTitle>
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">12</div>
      <p className="text-xs text-gray-500">+2 from yesterday</p>
    </CardContent>
  </Card>
</div>
```

### Form Components

#### Input Field Pattern
```tsx
<div className="space-y-2">
  <Label htmlFor="email">
    Email
    <span className="text-red-500 ml-1">*</span>
  </Label>
  <Input
    id="email"
    type="email"
    placeholder="john@example.com"
    className="w-full"
  />
  <p className="text-xs text-gray-500">
    We'll never share your email
  </p>
</div>
```

#### Form Layout
```tsx
<form className="space-y-6">
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
    <div className="space-y-2">
      {/* First Name Field */}
    </div>
    <div className="space-y-2">
      {/* Last Name Field */}
    </div>
  </div>
  
  <div className="flex justify-end gap-4 pt-4 border-t">
    <Button variant="outline" type="button">
      Cancel
    </Button>
    <Button type="submit">
      Save Changes
    </Button>
  </div>
</form>
```

### Data Display

#### Table Pattern
```tsx
<Card>
  <CardHeader>
    <div className="flex justify-between items-center">
      <CardTitle>Appointments</CardTitle>
      <Button size="sm">
        <Plus className="w-4 h-4 mr-2" />
        Add New
      </Button>
    </div>
  </CardHeader>
  <CardContent>
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Client</TableHead>
          <TableHead>Service</TableHead>
          <TableHead>Time</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {/* Table rows */}
      </TableBody>
    </Table>
  </CardContent>
</Card>
```

#### List Card Pattern
```tsx
<Card className="hover:shadow-md transition-shadow cursor-pointer">
  <CardHeader className="pb-3">
    <div className="flex items-start justify-between">
      <div>
        <CardTitle className="text-lg">John Doe</CardTitle>
        <CardDescription>Dog Grooming • 2:00 PM</CardDescription>
      </div>
      <Badge variant="outline">Confirmed</Badge>
    </div>
  </CardHeader>
  <CardContent className="space-y-3">
    <div className="flex items-center gap-2 text-sm text-gray-600">
      <MapPin className="w-4 h-4" />
      <span>123 Main St, City</span>
    </div>
    <div className="flex items-center gap-2 text-sm text-gray-600">
      <Clock className="w-4 h-4" />
      <span>45 minutes</span>
    </div>
  </CardContent>
</Card>
```

### Feedback Components

#### Loading States
```tsx
{/* Inline Loading */}
<div className="flex items-center justify-center py-8">
  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
</div>

{/* Skeleton Loading */}
<Card>
  <CardHeader>
    <Skeleton className="h-4 w-[200px]" />
    <Skeleton className="h-3 w-[150px]" />
  </CardHeader>
  <CardContent>
    <Skeleton className="h-20 w-full" />
  </CardContent>
</Card>
```

#### Empty States
```tsx
<div className="text-center py-12">
  <Users className="w-12 h-12 mx-auto text-gray-400 mb-4" />
  <h3 className="text-lg font-medium text-gray-900 mb-2">
    No clients yet
  </h3>
  <p className="text-gray-600 mb-4">
    Get started by adding your first client
  </p>
  <Button>
    <Plus className="w-4 h-4 mr-2" />
    Add First Client
  </Button>
</div>
```

#### Alert Messages
```tsx
{/* Success Alert */}
<Alert className="border-green-200 bg-green-50">
  <CheckCircle className="h-4 w-4 text-green-600" />
  <AlertTitle className="text-green-800">Success!</AlertTitle>
  <AlertDescription className="text-green-700">
    Your appointment has been saved locally and will sync when online.
  </AlertDescription>
</Alert>

{/* Warning Alert */}
<Alert className="border-amber-200 bg-amber-50">
  <AlertTriangle className="h-4 w-4 text-amber-600" />
  <AlertTitle className="text-amber-800">Offline Mode</AlertTitle>
  <AlertDescription className="text-amber-700">
    You're working offline. Changes will sync automatically when reconnected.
  </AlertDescription>
</Alert>
```

## 📱 Responsive Design

### Breakpoints
```css
/* Tailwind v4 Default Breakpoints */
--screen-sm: 640px;   /* Small devices */
--screen-md: 768px;   /* Medium devices */
--screen-lg: 1024px;  /* Large devices */
--screen-xl: 1280px;  /* Extra large devices */
--screen-2xl: 1536px; /* 2X large devices */
```

### Mobile-First Patterns
```tsx
{/* Mobile Stack → Desktop Grid */}
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  {/* Cards */}
</div>

{/* Mobile Hidden → Desktop Visible */}
<nav className="hidden md:flex gap-6">
  {/* Navigation items */}
</nav>

{/* Mobile Drawer → Desktop Sidebar */}
<aside className="fixed inset-y-0 left-0 w-64 transform -translate-x-full md:translate-x-0 md:static">
  {/* Sidebar content */}
</aside>
```

## 🎭 Animation & Transitions

### Micro-Interactions
```css
/* Button Hover */
.button-hover {
  @apply transition-colors duration-200 hover:bg-opacity-90;
}

/* Card Hover */
.card-hover {
  @apply transition-shadow duration-300 hover:shadow-md;
}

/* Smooth Accordion */
.accordion-content {
  @apply transition-all duration-300 ease-in-out;
}
```

### Loading Animations
```tsx
{/* Pulse Animation */}
<div className="animate-pulse">
  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
  <div className="h-4 bg-gray-200 rounded w-1/2" />
</div>

{/* Spin Animation */}
<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />

{/* Bounce Animation */}
<div className="animate-bounce">
  <ArrowDown className="w-6 h-6" />
</div>
```

## 🌗 Dark Mode Support

### Color Scheme
```css
/* Dark Mode Variables */
@media (prefers-color-scheme: dark) {
  :root {
    --background: 222 47% 11%;
    --foreground: 0 0% 95%;
    --primary: 217 91% 60%;
    --secondary: 217 33% 17%;
    --accent: 142 76% 36%;
    --card: 222 47% 15%;
    --border: 217 33% 25%;
  }
}
```

### Dark Mode Classes
```tsx
{/* Automatic Dark Mode */}
<div className="bg-white dark:bg-gray-900">
  <h1 className="text-gray-900 dark:text-white">
    Dark Mode Ready
  </h1>
</div>
```

## 📐 Layout Patterns

### Container Widths
```tsx
{/* Full Width with Max Width */}
<div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
  {/* Content */}
</div>

{/* Centered Content */}
<div className="max-w-4xl mx-auto">
  {/* Article or form content */}
</div>

{/* Narrow Modal */}
<div className="max-w-md mx-auto">
  {/* Modal content */}
</div>
```

### Grid Systems
```tsx
{/* 12-Column Grid */}
<div className="grid grid-cols-12 gap-6">
  <div className="col-span-12 md:col-span-8">Main Content</div>
  <div className="col-span-12 md:col-span-4">Sidebar</div>
</div>

{/* Auto-Fit Grid */}
<div className="grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-6">
  {/* Cards that auto-adjust */}
</div>
```

## 🎯 Component States

### Interactive States
```tsx
{/* Default State */}
<Button className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800">
  Click Me
</Button>

{/* Disabled State */}
<Button disabled className="opacity-50 cursor-not-allowed">
  Disabled
</Button>

{/* Loading State */}
<Button disabled>
  <Loader className="w-4 h-4 mr-2 animate-spin" />
  Loading...
</Button>

{/* Focus State */}
<Input className="focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
```

## 📱 Mobile Optimizations

### Touch Targets
```tsx
{/* Minimum 44x44px touch targets */}
<Button className="min-h-[44px] min-w-[44px] px-4">
  Tap Me
</Button>

{/* Increased tap area for icons */}
<button className="p-2 -m-2">
  <X className="w-5 h-5" />
</button>
```

### Mobile Navigation
```tsx
{/* Bottom Navigation for Mobile */}
<nav className="fixed bottom-0 left-0 right-0 bg-white border-t md:hidden">
  <div className="grid grid-cols-4 h-16">
    <button className="flex flex-col items-center justify-center">
      <Home className="w-5 h-5" />
      <span className="text-xs mt-1">Home</span>
    </button>
    {/* More nav items */}
  </div>
</nav>
```

## 🔧 Utility Classes

### Custom Utilities
```css
/* Scrollbar Styling */
.scrollbar-thin::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.scrollbar-thin::-webkit-scrollbar-track {
  @apply bg-gray-100;
}

.scrollbar-thin::-webkit-scrollbar-thumb {
  @apply bg-gray-400 rounded-full;
}

/* Text Truncation */
.truncate-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Safe Area for Mobile */
.safe-top {
  padding-top: env(safe-area-inset-top);
}

.safe-bottom {
  padding-bottom: env(safe-area-inset-bottom);
}
```

## 🎨 Design Tokens Export

### CSS Variables
```css
:root {
  /* Colors */
  --color-primary: #4F7FE3;
  --color-success: #16A34A;
  --color-warning: #F59E0B;
  --color-error: #EF4444;
  
  /* Spacing */
  --spacing-unit: 0.25rem;
  
  /* Border Radius */
  --radius-sm: 0.25rem;
  --radius-md: 0.375rem;
  --radius-lg: 0.5rem;
  --radius-xl: 0.75rem;
  --radius-full: 9999px;
  
  /* Shadows */
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1);
  
  /* Transitions */
  --transition-fast: 150ms;
  --transition-base: 200ms;
  --transition-slow: 300ms;
}
```

## 📋 Accessibility Guidelines

### ARIA Labels
```tsx
<Button aria-label="Delete appointment" title="Delete">
  <Trash2 className="w-4 h-4" />
</Button>

<nav aria-label="Main navigation">
  {/* Navigation items */}
</nav>

<Alert role="alert" aria-live="polite">
  {/* Alert content */}
</Alert>
```

### Keyboard Navigation
```tsx
{/* Focus visible styles */}
<Button className="focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
  Keyboard Accessible
</Button>

{/* Skip to content */}
<a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4">
  Skip to main content
</a>
```

## 🚀 Performance Guidelines

### Critical CSS
- Inline critical styles for above-the-fold content
- Lazy load non-critical stylesheets
- Minimize CSS bundle size with PurgeCSS

### Image Optimization
```tsx
<Image
  src="/avatar.jpg"
  alt="User avatar"
  width={40}
  height={40}
  className="rounded-full"
  loading="lazy"
/>
```

### Component Code Splitting
```tsx
const HeavyComponent = dynamic(() => import('./HeavyComponent'), {
  loading: () => <Skeleton className="h-32 w-full" />,
  ssr: false
})
```

---

This design system ensures consistency, accessibility, and performance across the entire KE Agenda application while maintaining a professional, modern appearance optimized for mobile service professionals.