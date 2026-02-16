# Wingspan Score Tracker - Design Documentation

A comprehensive design system for a Svelte-based web application tracking Wingspan board game statistics across multiple players and leagues.

## 🛠 Development

- **Env**: `JWT_SECRET` (required in production); optional `DATABASE_PATH` (default `database/wingspan.db`).
- **Run**: `npm run dev`
- **Seed DB**: `npm run seed`
- **Tests**: `npm run test` or `npm run test:watch` (Vitest; see `docs/development/ARCHITECTURE.md`).
- **Architecture**: `docs/development/ARCHITECTURE.md` – stack, auth, data model, tests.

## 📋 Design Documents

This repository contains complete design documentation for the Wingspan Score Tracker application:

### [DESIGN.md](./DESIGN.md) - Main Design Document
Comprehensive system design including:
- System architecture and structure
- Database schema design
- Component architecture
- API design
- Styling guide with DaisyUI integration
- State management
- Security considerations
- Performance optimization
- Testing strategy

### [COMPONENT_SPECS.md](./COMPONENT_SPECS.md) - Component Specifications
Detailed specifications for all reusable components:
- Shared components (Button, Card, Input, Table, Badge, Modal)
- Auth components (LoginForm, RegisterForm)
- League components (LeagueSelector, LeagueCard, PlayerCard, CreateLeagueModal)
- Scoreboard components (StatsTable, ScoringBreakdown, PerformanceChart, AddGameModal)
- Component dependencies and usage examples

### [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) - API Reference
Complete API endpoint documentation:
- Authentication endpoints (register, login, logout, me)
- League endpoints (list, create, get details)
- Statistics endpoints (league stats)
- Game endpoints (create, get details, list)
- Request/response formats
- Error handling
- Validation rules

### [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) - Database Design
Database schema and relationships:
- Entity relationship diagrams
- Table structures and constraints
- Indexes for performance
- Sample queries
- Initialization scripts
- Migration strategy

### [USER_FLOWS.md](./USER_FLOWS.md) - User Flow Diagrams
Visual flow diagrams for:
- Authentication flow
- League selection flow
- Add game flow
- View statistics flow
- Registration flow
- Navigation flow

## 🎨 Design System

### Visual Style
- **Aesthetic**: Dark tactical professional
- **Inspiration**: Fleet tracking dashboard
- **Color Palette**: Dark backgrounds (#0a0a0a, #1a1a1a) with vibrant player accents
- **Typography**: System fonts with clear hierarchy

### Key Features
- **Reusable Components**: All components built with DaisyUI and custom styling
- **Responsive Design**: Mobile-first approach with breakpoints
- **Accessibility**: WCAG 2.1 AA compliance
- **Performance**: Optimized queries and lazy loading

## 🏗️ Architecture Overview

### Technology Stack
- **Frontend**: SvelteKit
- **UI Library**: DaisyUI (Tailwind CSS)
- **Database**: SQLite (lightweight, file-based)
- **Authentication**: JWT tokens with httpOnly cookies
- **Backend**: SvelteKit API routes

### Core Entities
1. **Users**: Player accounts with authentication
2. **Leagues**: Groups of 3 players
3. **Games**: Individual game sessions
4. **Scores**: Detailed scoring data per player per game

### Key Statistics Tracked
- Average placement
- First place finishes
- Average total score
- Average scoring breakdown:
  - Birds
  - Bonus Cards
  - End of Round Goals
  - Eggs
  - Food on Cards
  - Tucked Cards
  - Nectar

## 📊 Database Schema

### Tables
- `users` - User accounts
- `leagues` - League definitions
- `league_players` - Many-to-many relationship (league ↔ users)
- `games` - Game sessions
- `scores` - Detailed scoring data

### Relationships
- One user can belong to many leagues
- One league has exactly 3 players
- One game has exactly 3 scores (one per player)
- Scores include placement and detailed breakdown

## 🎯 User Flow

1. **Visit App** → Check authentication
2. **Not Authenticated** → Login/Register
3. **Authenticated** → View leagues
4. **Select League** → View scoreboard with stats
5. **Add Game** → Enter scores for all 3 players
6. **View Stats** → See updated statistics

## 🔐 Security

- Password hashing with bcrypt
- JWT tokens in httpOnly cookies
- SQL injection prevention via parameterized queries
- XSS prevention via Svelte escaping
- CSRF protection via SameSite cookies
- Rate limiting on auth endpoints

## 📱 Responsive Design

### Breakpoints
- **Desktop**: ≥1024px (two-column layout)
- **Tablet**: 768px - 1023px (stacked layout)
- **Mobile**: <768px (single column, bottom navigation)

## 🚀 Implementation Phases

### Phase 1: Foundation
- Project setup
- Database schema
- Authentication system
- Basic routing

### Phase 2: Core Features
- User registration/login
- League creation/selection
- Player management
- Game score entry

### Phase 3: Statistics
- Stats calculation
- Scoreboard display
- Scoring breakdown visualization
- Performance charts

### Phase 4: Polish
- Responsive design
- Error handling
- Loading states
- Animations

## 📝 Component Reusability

All components are designed for maximum reusability:
- Consistent prop interfaces
- Slot-based content injection
- DaisyUI class integration
- Custom styling via props
- Event-based communication

## 🎨 Color System

### Player Colors
- **Player 1**: `#4A90E2` (Blue)
- **Player 2**: `#FF6B35` (Orange)
- **Player 3**: `#9B59B6` (Purple)

### Status Colors
- **Success**: `#4CAF50` (Green)
- **Warning**: `#FFC107` (Yellow)
- **Error**: `#FF6B35` (Orange)

### Background Colors
- **Primary**: `#0a0a0a`
- **Secondary**: `#1a1a1a`
- **Panel**: `#141414`
- **Card**: `#1f1f1f`

## 📚 Next Steps

1. Review design documents
2. Set up SvelteKit project
3. Initialize database
4. Implement authentication
5. Build reusable components
6. Create API endpoints
7. Implement statistics calculations
8. Add visualizations
9. Test and refine
10. Deploy

## 📄 License

This design documentation is provided for implementation purposes.

---

**Design Status**: ✅ Complete
**Last Updated**: 2024-01-20

For implementation questions, refer to the detailed specifications in each design document.
