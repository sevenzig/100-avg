# Wingspan Score Tracker - Modern League Table Design System

## Design Philosophy
**Purpose**: Functional logging application with league table focus
**Style**: Modern, data-focused, clean, professional
**Inspiration**: Sports league tables, data dashboards, logging interfaces

## Color Palette

### Primary Colors
- **Background Primary**: `#F8FAFC` (slate-50) - Light, clean background
- **Background Secondary**: `#FFFFFF` - Pure white for cards
- **Background Tertiary**: `#F1F5F9` (slate-100) - Subtle panel backgrounds
- **Border**: `#E2E8F0` (slate-200) - Light borders for separation

### Text Colors
- **Primary Text**: `#0F172A` (slate-900) - High contrast, readable
- **Secondary Text**: `#475569` (slate-600) - Muted labels
- **Tertiary Text**: `#94A3B8` (slate-400) - Subtle hints
- **Inverse Text**: `#FFFFFF` - Text on colored backgrounds

### Accent Colors (Player Colors)
- **Player 1**: `#3B82F6` (blue-500) - Primary actions
- **Player 2**: `#F59E0B` (amber-500) - Secondary
- **Player 3**: `#8B5CF6` (violet-500) - Accent
- **Success**: `#10B981` (emerald-500) - Wins, positive
- **Warning**: `#F59E0B` (amber-500) - Cautions
- **Error**: `#EF4444` (red-500) - Errors

### Table Colors
- **Header Background**: `#F1F5F9` (slate-100)
- **Row Hover**: `#F8FAFC` (slate-50)
- **Zebra Stripe**: `#FAFBFC` (alternating rows)
- **Border**: `#E2E8F0` (slate-200)

## Typography

### Font Stack
```css
font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
```

### Font Sizes
- **Display**: 32px (2rem) - Page titles
- **H1**: 24px (1.5rem) - Section headers
- **H2**: 20px (1.25rem) - Subsection headers
- **H3**: 18px (1.125rem) - Card titles
- **Body**: 15px (0.9375rem) - Default text
- **Small**: 13px (0.8125rem) - Labels, captions
- **Tiny**: 11px (0.6875rem) - Badges, metadata

### Font Weights
- **Display/H1**: 700 (bold)
- **H2/H3**: 600 (semibold)
- **Body**: 400 (regular)
- **Labels**: 500 (medium)
- **Numbers**: 500 (medium) - Better readability

### Number Typography
- **Monospace for numbers**: `font-family: 'JetBrains Mono', 'Fira Code', 'Courier New', monospace`
- **Tabular numbers**: `font-variant-numeric: tabular-nums` for alignment

## Spacing System

### Base Unit: 4px
- **xs**: 4px (0.25rem)
- **sm**: 8px (0.5rem)
- **md**: 16px (1rem)
- **lg**: 24px (1.5rem)
- **xl**: 32px (2rem)
- **2xl**: 48px (3rem)

### Component Spacing
- **Card Padding**: 24px (1.5rem)
- **Section Padding**: 32px (2rem)
- **Table Cell Padding**: 12px vertical, 16px horizontal
- **Input Height**: 44px
- **Button Height**: 40px
- **Table Row Height**: 56px

## Layout Principles

### League Table Focus
1. **Primary View**: League standings table should be the hero element
2. **Secondary Info**: Player cards, charts are supporting information
3. **Data Density**: Optimize for scanning large amounts of data
4. **Visual Hierarchy**: Clear ranking, clear metrics

### Grid System
- **Container Max Width**: 1280px (max-w-7xl)
- **Table Full Width**: Tables should span full container
- **Card Grid**: Responsive grid for cards (1 col mobile, 2-3 col desktop)

## Component Patterns

### League Table
- **Style**: Clean, minimal borders
- **Header**: Sticky, light gray background
- **Rows**: Zebra striping for readability
- **Hover**: Subtle background change
- **Ranking**: Visual indicators (medals, numbers)
- **Numbers**: Right-aligned, monospace font
- **Player Names**: Left-aligned, colored by player

### Cards
- **Background**: White (#FFFFFF)
- **Border**: 1px solid #E2E8F0
- **Shadow**: Subtle (shadow-sm)
- **Border Radius**: 8px
- **Padding**: 24px

### Buttons
- **Primary**: Blue-500 background, white text
- **Secondary**: White background, blue-500 text, border
- **Ghost**: Transparent, text only
- **Height**: 40px
- **Padding**: 12px 24px
- **Border Radius**: 6px

### Inputs
- **Background**: White
- **Border**: 1px solid #E2E8F0
- **Focus**: Blue-500 border
- **Height**: 44px
- **Padding**: 12px 16px
- **Border Radius**: 6px

## Effects & Interactions

### Transitions
- **Default**: 150ms ease-in-out
- **Hover**: Color changes, subtle scale (1.02)
- **Focus**: Ring outline, 2px blue-500

### Shadows
- **Card**: `shadow-sm` (0 1px 2px rgba(0,0,0,0.05))
- **Hover**: `shadow-md` (0 4px 6px rgba(0,0,0,0.1))
- **Modal**: `shadow-xl` (0 20px 25px rgba(0,0,0,0.1))

## Accessibility

### Contrast Ratios
- **Text on White**: Minimum 4.5:1 (slate-600 meets this)
- **Text on Colored**: Minimum 4.5:1
- **Interactive Elements**: Clear focus states

### Keyboard Navigation
- **Tab Order**: Logical flow
- **Focus Indicators**: Visible 2px blue ring
- **Skip Links**: For main content

## Responsive Breakpoints

- **Mobile**: < 640px - Single column, stacked
- **Tablet**: 640px - 1024px - 2 columns
- **Desktop**: > 1024px - Full layout, sidebars

## Anti-Patterns to Avoid

1. ❌ **Too dark backgrounds** - Hard to read, not modern
2. ❌ **Decorative elements** - Focus on function
3. ❌ **Inconsistent spacing** - Use spacing system
4. ❌ **Poor number alignment** - Use tabular-nums
5. ❌ **Weak visual hierarchy** - Clear ranking indicators
6. ❌ **Cluttered tables** - Clean, minimal borders
7. ❌ **No hover states** - Provide feedback
8. ❌ **Poor contrast** - Ensure readability
