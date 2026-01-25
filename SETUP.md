# Wingspan Score Tracker - Setup Guide

## Prerequisites

- Node.js 18+ and npm
- Git (optional)

## Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   Create a `.env` file in the root directory:
   ```env
   DATABASE_PATH=./database/wingspan.db
   JWT_SECRET=your-secret-key-change-in-production
   NODE_ENV=development
   ```

   **Important:** Change `JWT_SECRET` to a secure random string in production!

3. **Database setup:**
   The database will be automatically created on first run. The database directory (`database/`) will be created automatically.

## Running the Application

### Development Mode

```bash
npm run dev
```

The application will be available at `http://localhost:5173`

### Production Build

```bash
npm run build
npm run preview
```

## Project Structure

```
wingspan-score/
├── src/
│   ├── lib/
│   │   ├── components/      # Reusable components
│   │   │   ├── auth/        # Authentication components
│   │   │   ├── league/      # League-related components
│   │   │   ├── scoreboard/  # Scoreboard components
│   │   │   └── shared/      # Shared UI components
│   │   ├── stores/          # Svelte stores
│   │   └── utils/           # Utility functions
│   ├── routes/
│   │   ├── (auth)/         # Public routes (login, register)
│   │   ├── (protected)/    # Protected routes (leagues, scoreboard)
│   │   └── api/            # API endpoints
│   └── app.css             # Global styles
├── database/               # SQLite database (auto-created)
├── static/                 # Static assets
└── package.json
```

## Features

- ✅ User authentication (register, login, logout)
- ✅ League management (create, view leagues)
- ✅ Game score entry with detailed breakdown
- ✅ Statistics dashboard with:
  - Average placement
  - Win/loss records
  - Average scores
  - Scoring breakdown by category
  - Performance charts over time

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/me` - Get current user

### Leagues
- `GET /api/leagues` - Get user's leagues
- `POST /api/leagues` - Create new league
- `GET /api/leagues/[id]` - Get league details
- `GET /api/leagues/[id]/stats` - Get league statistics
- `GET /api/leagues/[id]/games` - Get league game history

### Games
- `POST /api/games` - Create new game
- `GET /api/games/[id]` - Get game details

## Database

The application uses SQLite for data storage. The database file is located at `database/wingspan.db` (or as specified in `DATABASE_PATH`).

### Tables
- `users` - User accounts
- `leagues` - League definitions
- `league_players` - League membership (many-to-many)
- `games` - Game sessions
- `scores` - Detailed scoring data

## Development Notes

- The database schema is automatically initialized on server start
- Authentication uses JWT tokens stored in httpOnly cookies
- All API routes require authentication except `/api/auth/register` and `/api/auth/login`
- The application uses DaisyUI for styling with a custom dark theme

## Troubleshooting

### Database errors
- Ensure the `database/` directory exists and is writable
- Check that `DATABASE_PATH` in `.env` is correct

### Authentication issues
- Clear browser cookies if experiencing login issues
- Verify `JWT_SECRET` is set in `.env`

### Build errors
- Run `npm install` to ensure all dependencies are installed
- Clear `.svelte-kit` directory and rebuild if needed

## Next Steps

1. Run `npm install` to install dependencies
2. Create `.env` file with your configuration
3. Run `npm run dev` to start development server
4. Visit `http://localhost:5173` and register a new account
5. Create your first league and start tracking games!
