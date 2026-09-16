# Fan Director Studio — Design System

## Overview
Complete design system for Maya Atelier's boutique creator commission platform. Fictional demonstration with 8 interconnected pages covering fan commission workflow and creator approval dashboard.

---

## Color Palette

### Primary Colors
- **Background (Cream)**: `#FDF8F3`
- **Panel (White)**: `#FFFFFF`
- **Secondary (Light Beige)**: `#F5F0EB`
- **Primary Text (Espresso)**: `#302720`
- **Muted Text**: `#70625C`
- **Divider Rules**: `#DED3CB`

### Accent Colors
- **Dusty Rose (Primary Accent)**: `#E4A4BD`
- **Deep Rose (Secondary Accent)**: `#84485D`
- **Alert/Destructive**: `#E37A6A` (with hover: `#D66A5A`)
- **Success/Confirmation**: `#8EB486`

### Status Colors (Creator Dashboard)
- **New Request**: `#4B9FE3` (blue)
- **Pending Response**: `#D4A574` (warm tan)
- **Alert/Changes Needed**: `#E37A6A` (alert red)
- **Approved**: `#8EB486` (green)

### CSS Variables Implementation
```css
:root {
  --color-bg: #FDF8F3;
  --color-panel: #FFFFFF;
  --color-secondary: #F5F0EB;
  --color-text-primary: #302720;
  --color-text-muted: #70625C;
  --color-divider: #DED3CB;
  --color-rose: #E4A4BD;
  --color-deeprose: #84485D;
  --color-alert: #E37A6A;
  --color-success: #8EB486;
}
```

---

## Typography

### Font Families
- **Serif (Headings)**: Cormorant Garamond (400, 500, 600, 700)
- **Sans-serif (UI/Body)**: Inter (300, 400, 500, 600)
- **Monospace (Order IDs)**: JetBrains Mono (400, 500)

### Type Scale
- **Hero Heading**: 44px–56px, Cormorant Garamond 600–700, tracking-tight
- **Section Heading**: 28px–36px, Cormorant Garamond 600, tracking-tight
- **Card Title**: 24px–32px, Cormorant Garamond 600
- **Body Text**: 16px, Inter 400, line-height 1.5
- **UI Labels**: 14px, Inter 500, uppercase tracking-wider
- **Small UI Text**: 12px, Inter 400, text-muted
- **Monospace IDs**: 14px, JetBrains Mono 400 (for order numbers, references)

### Line Heights
- Headings: 1.2
- Body: 1.5
- UI Labels: 1.2

---

## Spacing & Layout

### Grid System
- **Max Width**: 1320px (desktop container)
- **Columns**: 12-column grid
- **Desktop Margins**: 32px
- **Tablet Margins**: 24px
- **Mobile Margins**: 16px

### Spacing Scale (8px base)
- xs: 4px
- sm: 8px
- md: 12px
- lg: 16px
- xl: 24px
- 2xl: 32px
- 3xl: 40px
- 4xl: 48px

### Component Spacing
- **Section Spacing**: 24px (vertical gap between major sections)
- **Grid Gaps**: 16px–24px
- **Card Padding**: 24px (mobile) / 32px (desktop)
- **Margin Bottom (Large Sections)**: 80px (mb-20)
- **Margin Bottom (Medium Sections)**: 40px (mb-10)

### Touch Targets
- **Minimum Height**: 44px (mobile), 48px (desktop)
- **Buttons**: 44px–48px height
- **Icon Buttons**: 40px (mobile), 44px+ (desktop)

---

## Border & Radius

### Corner Radius
- **Default (Cards, Inputs, Buttons)**: 12px (rounded-[12px])
- **Slight Rounding (Badges)**: 6px–8px
- **Full Rounding (Circles, Avatars)**: 50% (rounded-full)
- **No Rounding (Fine Rules)**: 0px

### Borders
- **Divider Rules**: 1px solid `#DED3CB` (fine, neutral)
- **Card Borders**: 1px solid `#DED3CB`
- **Button Borders**: 1px solid `#DED3CB` (secondary buttons)
- **Focus Ring**: 2px solid `#302720`, offset 2px

---

## Shadows & Depth

### Shadow System
- **Subtle (Cards, Modals)**: `0 8px 30px rgba(0,0,0,0.04)`
- **Medium (Hover States)**: Box-shadow lift on hover
- **Modal Backdrop**: `0 20px 60px rgba(0,0,0,0.08)`
- **Light (Buttons)**: `shadow-sm` (minimal depth)
- **Elevated (Sticky Components)**: Subtle shadow + backdrop-blur

### Hover & Focus States
- **Card Hover**: Shadow lift + subtle color shift (border/text)
- **Button Hover**: Background color change + cursor pointer
- **Focus Ring**: 2px espresso outline, 2px offset (all interactive elements)
- **Link Hover**: Color shift to rose or muted (context-dependent)

---

## Animations & Transitions

### Duration Standards
- **Standard Transition**: 160ms
- **Selection Animation**: 200ms
- **Load/Entry Animation**: 400ms–600ms

### Animation Types
- **Smooth Color/Shadow Transitions**: 160ms ease-out
- **Selection Bounce**: 400ms cubic-bezier(0.175, 0.885, 0.32, 1.275)
- **Price Update Flash**: 2s ease-out (rose highlight flash)
- **Modal Entrance**: Bounce-in 600ms with scale(0.9→1) + opacity(0→1)
- **Page Scroll**: smooth scroll-behavior

### Reduced Motion Support
Honor `prefers-reduced-motion` media query (remove animations for accessibility)

---

## Component Library

### 1. Header / Navigation Bar
**File Locations**: All 8 pages (sticky top-0 z-50)

**Structure**:
```html
<header class="sticky top-0 z-50 bg-cream/95 backdrop-blur-sm border-b border-divider">
  <div class="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 h-[80px] flex items-center justify-between">
    <!-- Logo / Brand -->
    <div class="flex items-center gap-4 sm:gap-6">
      <a href="#" class="font-serif text-2xl sm:text-3xl font-medium tracking-tight">
        Maya Atelier
      </a>
      <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] sm:text-xs font-medium bg-secondary text-muted border border-divider">
        Demo
      </span>
    </div>

    <!-- Center Nav (Hidden on Mobile) -->
    <nav class="hidden md:flex items-center gap-8">
      <a href="#collection" class="text-sm font-medium hover:text-muted transition-colors focus-ring">Collection</a>
      <a href="#studio" class="text-sm font-medium hover:text-muted transition-colors focus-ring">Your studio</a>
      <a href="#saved" class="text-sm font-medium hover:text-muted transition-colors focus-ring">Saved ideas</a>
    </nav>
  </div>
</header>
```

**Styling Notes**:
- Sticky positioning (top-0, z-50 for stacking context)
- Backdrop blur for modern feel
- Responsive typography (scales on mobile)
- Focus rings on all links
- Min height 80px for touch targets

---

### 2. Request Card (Creator Dashboard)
**Used In**: Creator Dashboard

**Structure** (clickable <a> element):
```html
<a href="https://p.superdesign.dev/draft/c6e6d108-a7c9-4d51-90b2-4090ebce1a93" 
   class="block bg-panel border border-divider rounded-[12px] p-6 shadow-sm hover:shadow-md transition-all duration-160 cursor-pointer group">
  
  <!-- Header Row: Avatar + Status -->
  <div class="flex justify-between items-start mb-4">
    <div class="flex items-center gap-3">
      <div class="w-8 h-8 rounded-full bg-cream border border-divider flex items-center justify-center text-xs font-medium text-espresso">
        SS
      </div>
      <span class="text-sm font-medium text-muted">@sarah_smiles</span>
    </div>
    <div class="flex items-center gap-2">
      <span class="text-xs font-medium text-status-new">New</span>
      <iconify-icon icon="lucide:circle-dot" class="text-status-new" width="18"></iconify-icon>
    </div>
  </div>

  <!-- Title -->
  <h3 class="font-serif text-2xl font-bold mb-2 group-hover:text-deeprose transition-colors duration-160">
    Vintage Lounge Greeting
  </h3>

  <!-- Description -->
  <p class="text-sm text-muted mb-6 line-clamp-2">
    Birthday message for my sister. 3-minute video...
  </p>

  <hr class="border-t border-divider mb-4">

  <!-- Footer: Price + Delivery -->
  <div class="flex items-center justify-between">
    <div class="flex flex-col">
      <span class="text-xs text-muted mb-1">Estimated Total</span>
      <span class="text-base font-semibold">$145.00</span>
    </div>
    <div class="flex flex-col text-right">
      <span class="text-xs text-muted mb-1">Requested Delivery</span>
      <span class="text-sm font-medium">Dec 12 (in 5 days)</span>
    </div>
  </div>
</a>
```

**Key Features**:
- Entire card is clickable (display: block on <a>)
- Status icon + color-coded badge (top-right)
- Hover state: shadow lift + text color (deeprose)
- Two-column footer layout: price left, delivery right
- Avatar circle for fan identity

---

### 3. Primary CTA Button
**Used In**: All pages (main action CTAs)

**Structure** (as <a> link):
```html
<a href="https://p.superdesign.dev/draft/..." 
   class="w-full sm:w-auto px-8 h-[48px] rounded-[12px] bg-rose text-espresso font-medium hover:bg-[#D595AE] transition-colors focus-ring flex items-center justify-center gap-2 shadow-sm">
  Send to Creator
  <iconify-icon icon="lucide:send" class="text-sm"></iconify-icon>
</a>
```

**Styling Notes**:
- Background: rose (`#E4A4BD`)
- Hover: darker rose (`#D595AE`)
- Min height: 48px
- Flexbox centered with icon gap
- Shadow for depth
- Focus ring for accessibility

---

### 4. Secondary Button
**Used In**: All pages (back/cancel actions)

**Structure**:
```html
<button class="w-full sm:w-auto px-8 h-[48px] rounded-[12px] border border-divider bg-transparent text-espresso font-medium hover:bg-white transition-colors focus-ring flex items-center justify-center gap-2">
  Back to Edit
</button>
```

**Styling Notes**:
- Transparent background
- Border: divider color
- Hover: white background
- Same height/padding as primary button

---

### 5. Scene Card Panel
**Used In**: AI Director Workspace (live preview), Review Scene Card

**Structure** (sticky on desktop, full-width on mobile):
```html
<div class="bg-panel rounded-[12px] border border-divider shadow-[0_8px_30px_rgba(0,0,0,0.04)] overflow-hidden">
  
  <!-- Header Section -->
  <div class="p-6 sm:p-10 border-b border-divider">
    <!-- Content -->
  </div>

  <!-- Components Grid -->
  <div class="p-6 sm:p-10 border-b border-divider">
    <h3 class="text-xs font-semibold uppercase tracking-wider text-muted mb-6">Included Components</h3>
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <!-- Component items -->
    </div>
  </div>

  <!-- Price Breakdown -->
  <div class="p-6 sm:p-10 bg-secondary flex flex-col md:flex-row gap-10">
    <!-- Price details -->
  </div>
</div>
```

**Key Features**:
- Multiple sections with divider borders
- Responsive padding (6px mobile, 10px desktop)
- Background color sectioning
- Icon-labeled component items
- Price line items with hover edit states

---

### 6. Progress Trail / Stepper
**Used In**: AI Director Workspace, Review Scene Card

**Structure**:
```html
<div class="flex items-center gap-2 text-sm text-muted">
  <span>Idea</span>
  <iconify-icon icon="lucide:chevron-right" class="text-xs"></iconify-icon>
  <span>Details</span>
  <iconify-icon icon="lucide:chevron-right" class="text-xs"></iconify-icon>
  <span class="font-medium text-espresso bg-rose/20 px-2 py-1 rounded-md">Review</span>
  <iconify-icon icon="lucide:chevron-right" class="text-xs"></iconify-icon>
  <span>Send</span>
</div>
```

**Styling Notes**:
- Active step: rose background (rose/20) + espresso text + bold
- Future steps: muted text
- Chevron separators
- Responsive (can collapse to step numbers on mobile)

---

### 7. Modal Overlay
**Used In**: Creator Detail Modal, Ask Question Modal, Decline Confirmation Modal

**Structure**:
```html
<!-- Backdrop -->
<div class="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
  
  <!-- Modal Content -->
  <div class="bg-panel rounded-[12px] shadow-[0_20px_60px_rgba(0,0,0,0.08)] w-full max-w-[1100px] flex flex-col relative max-h-full overflow-hidden">
    
    <!-- Close Button -->
    <a href="..." class="absolute top-4 right-4 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-cream/80 hover:bg-cream text-muted hover:text-espresso transition-colors duration-160">
      <iconify-icon icon="lucide:x" width="24"></iconify-icon>
    </a>

    <!-- Modal Body -->
    <div class="flex flex-col lg:flex-row flex-1 overflow-y-auto">
      <!-- Content -->
    </div>
  </div>
</div>
```

**Key Features**:
- Fixed full-screen backdrop (inset-0) with semi-transparent black
- Centered positioning (flex center)
- Z-index 50 (above all page content)
- Close button positioned absolutely (top-right)
- Scrollable body with custom scrollbar
- Max height for viewport constraint

---

### 8. Input & Textarea Components
**Used In**: Ask Question Modal, Composer (AI Director)

**Structure**:
```html
<!-- Text Input -->
<input type="text" 
       placeholder="Your name"
       class="w-full px-4 py-3 rounded-[12px] border border-divider bg-panel text-espresso placeholder:text-muted focus:border-espresso focus:outline-none transition-colors duration-160">

<!-- Textarea -->
<textarea placeholder="Your message here..." 
          class="w-full px-4 py-3 rounded-[12px] border border-divider bg-panel text-espresso placeholder:text-muted focus:border-espresso focus:outline-none resize-none h-32 transition-colors duration-160"></textarea>
```

**Styling Notes**:
- Border: divider color
- Focus: espresso border
- Placeholder: muted text
- Rounded corners: 12px
- Padding: 12px–16px
- No resize on textarea

---

### 9. Status Badges
**Used In**: Request cards, modals

**Color-Coded by Status**:
```html
<!-- New Request (Blue) -->
<span class="text-xs font-medium text-status-new">New</span>
<iconify-icon icon="lucide:circle-dot" class="text-status-new"></iconify-icon>

<!-- Pending Response (Tan) -->
<span class="text-xs font-medium text-status-pending">Awaiting Reply</span>
<iconify-icon icon="lucide:clock" class="text-status-pending"></iconify-icon>

<!-- Changes Needed (Red) -->
<span class="text-xs font-medium text-status-alert">Changes Pending</span>
<iconify-icon icon="lucide:alert-triangle" class="text-status-alert"></iconify-icon>

<!-- Approved (Green) -->
<span class="text-xs font-medium text-status-approved">Approved</span>
<iconify-icon icon="lucide:check-circle" class="text-status-approved"></iconify-icon>
```

---

### 10. Timeline Component
**Used In**: Send Confirmation (next steps timeline)

**Structure**:
```html
<div class="relative border-l border-divider ml-3 sm:ml-6 space-y-8">
  
  <!-- Active Step -->
  <div class="relative pl-8">
    <div class="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-rose border-4 border-cream"></div>
    <h4 class="text-base font-semibold text-espresso mb-1">1. Creator Reviews</h4>
    <p class="text-sm text-muted leading-relaxed">
      Maya will review your request within 24-48 hours...
    </p>
  </div>

  <!-- Inactive Steps (opacity-60) -->
  <div class="relative pl-8 opacity-60">
    <div class="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-panel border-4 border-divider"></div>
    <h4 class="text-base font-medium text-espresso mb-1">2. Payment Confirmation</h4>
    <p class="text-sm text-muted leading-relaxed">
      Once approved, you'll receive a link to complete payment...
    </p>
  </div>
  
</div>
```

**Key Features**:
- Vertical left border (divider color)
- Left padding for text offset
- Circular checkpoint (rose for active, divider for inactive)
- Opacity adjustment for inactive states
- Responsive margin (smaller on mobile)

---

## Responsive Design Patterns

### Breakpoints
- **Mobile**: <640px (sm)
- **Tablet**: 640px–1024px (md–lg)
- **Desktop**: >1024px (lg)

### Common Patterns
- **Hidden on Mobile**: `hidden md:flex` (nav items, desktop layouts)
- **Mobile Stack**: `flex-col md:flex-row` (switches from column to row)
- **Responsive Padding**: `px-4 sm:px-6 lg:px-8` (scales with viewport)
- **Responsive Typography**: `text-2xl sm:text-3xl` (scales headings)
- **Grid Columns**: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` (flow from single to multi-column)

### Mobile-Specific Optimization
- Sticky headers with backdrop blur
- Full-width cards (no gutters)
- Stacked modals (single column)
- Touch-friendly spacing (48px min buttons)
- Readable text sizes (16px minimum body)
- No horizontal overflow

---

## Page Templates

### 1. Boutique Entrance (82277dd9-3db3-4c9d-8e8c-272cff83b5fe)
- Hero section with inspiration image
- Three curated theme cards (clickable)
- Empty state for custom ideas
- Two-column grid layout (desktop)
- Navigation to AI Director

### 2. AI Director Workspace (048b6b8a-1e95-4352-b0eb-32e252b1e30f)
- Two-column layout (7-5 split)
- Left: Conversation thread
- Right: Live Scene Card (sticky desktop, mobile summary)
- Progress trail (4-step journey)
- Interactive choice cards with hover states
- Composer at bottom with send/suggest/undo
- Dynamic pricing updates

### 3. Review Scene Card (48723685-c114-4cee-b2c5-6b27b89fc2de)
- Single column centered layout
- Full scene card review panel
- Price breakdown section
- Timeline & boundaries callout
- Back & Send CTAs

### 4. Send Confirmation (a98b81cb-4ff3-43f7-b343-7091c69f78e3)
- Centered success layout
- Checkmark celebration icon
- Order details card
- Timeline (4-step next steps)
- CTAs: Save Idea, Back to Collection

### 5. Creator Dashboard (2b65d4ed-45e0-464d-a22b-56a70377752b)
- Header with nav tabs (Requests, Completed, Settings)
- Filter & sort dropdowns
- 2-column card grid (responsive to 1-column)
- 6 request cards with varied statuses
- Pending decisions indicator

### 6. Creator Detail Modal (c6e6d108-a7c9-4d51-90b2-4090ebce1a93)
- Modal overlay on dashboard
- Left column: Scene card details
- Right column: Decision controls
- Four action buttons (Approve, Propose, Ask, Decline)
- Close button (X top-right)

### 7. Ask Question Modal (5d2c9ba0-0041-4771-b9b3-cc7a17bd7463)
- Smaller modal overlay
- Form with name, email, message inputs
- Send Message & Cancel buttons
- Close button (X top-right)

### 8. Decline Confirmation Modal (7fc2a528-a81a-46a5-b7f4-b81af52a323a)
- Protective confirmation modal
- Alert icon & messaging
- Cancel & Confirm Decline buttons
- Close button (X top-right)

---

## Navigation Map

### Full Journey Connections
**Fan Path**: Boutique Entrance → AI Director → Review Card → Send Confirmation
**Creator Path**: Dashboard → Detail Modal → {Ask Question | Decline Confirmation} → Back

All navigation uses full preview URLs (https://p.superdesign.dev/draft/...) for cross-page linking.

---

## Design Principles

1. **Luxury Boutique Aesthetic**: Warm cream backgrounds, fine typography, generous whitespace
2. **Creator-Approved Boundaries**: Transparency about what's catalog vs. custom
3. **No False Claims**: Demo labeling, "Subject to approval" messaging throughout
4. **Deterministic Pricing**: Clear price breakdown, budget tracking, cost impact visibility
5. **Supportive Tone**: Gentle guidance, celebration moments, protective confirmation flows
6. **Accessibility First**: Focus rings, semantic buttons, readable contrast, 44px+ touch targets
7. **Responsive by Default**: Mobile-first, no horizontal overflow, readable on all sizes
8. **Subtle Motion**: 160ms transitions, bounce-in on load, no distracting animations
