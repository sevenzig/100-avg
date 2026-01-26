# Database Schema Design

## Entity Relationship Diagram

```
┌─────────────┐
│   users     │
├─────────────┤
│ id (PK)     │
│ username    │◄─────┐
│ email       │      │
│ password_   │      │
│   hash      │      │
│ created_at  │      │
│ updated_at  │      │
└─────────────┘      │
                     │
┌─────────────┐      │
│  leagues    │      │
├─────────────┤      │
│ id (PK)     │      │
│ name        │      │
│ created_by  │──────┘
│   (FK)      │
│ created_at  │
└─────────────┘
       │
       │ 1:N
       │
       ▼
┌──────────────────┐
│ league_players   │
├──────────────────┤
│ league_id (FK)   │───┐
│ user_id (FK)     │───┼───┐
│ player_color     │   │   │
│ joined_at        │   │   │
└──────────────────┘   │   │
                       │   │
┌─────────────┐        │   │
│   games     │        │   │
├─────────────┤        │   │
│ id (PK)     │        │   │
│ league_id   │────────┘   │
│   (FK)      │            │
│ played_at   │            │
│ created_by  │────────────┘
│   (FK)      │
└─────────────┘
       │
       │ 1:N
       │
       ▼
┌─────────────┐
│   scores    │
├─────────────┤
│ id (PK)     │
│ game_id     │───┐
│   (FK)      │   │
│ user_id     │───┼───┐
│   (FK)      │   │   │
│ placement   │   │   │
│ total_score │   │   │
│ birds       │   │   │
│ bonus_cards │   │   │
│ end_of_     │   │   │
│   round_    │   │   │
│   goals     │   │   │
│ eggs        │   │   │
│ food_on_    │   │   │
│   cards     │   │   │
│ tucked_     │   │   │
│   cards     │   │   │
│ nectar      │   │   │
│ created_at  │   │   │
└─────────────┘   │   │
                  │   │
                  └───┘
            (game_id, user_id) UNIQUE
```

## Table Relationships

### One-to-Many Relationships
1. **users → leagues**: One user can create many leagues (`created_by`)
2. **leagues → games**: One league can have many games
3. **games → scores**: One game has exactly 3 scores
4. **users → scores**: One user can have many scores across games

### Many-to-Many Relationships
1. **users ↔ leagues**: Through `league_players` table
   - One user can belong to many leagues
   - One league has exactly 3 users

## Data Integrity Constraints

### Primary Keys
- All tables have `id` as primary key (INTEGER AUTOINCREMENT)

### Foreign Keys
- `leagues.created_by` → `users.id`
- `league_players.league_id` → `leagues.id`
- `league_players.user_id` → `users.id`
- `games.league_id` → `leagues.id`
- `games.created_by` → `users.id`
- `scores.game_id` → `games.id`
- `scores.user_id` → `users.id`

### Unique Constraints
- `users.username` UNIQUE
- `users.email` UNIQUE
- `league_players(league_id, user_id)` PRIMARY KEY (composite)
- `scores(game_id, user_id)` UNIQUE (one score per user per game)

### Check Constraints
- `scores.placement` IN (1, 2, 3)
- `scores.total_score` = sum of all breakdown categories
- `league_players.player_color` IN ('player_1', 'player_2', 'player_3')

### Business Rules (Enforced in Application)
- Each league must have exactly 3 players
- Each game must have exactly 3 scores
- Placements in a game must be 1, 2, 3 (unique)
- All breakdown values must be non-negative integers

## Indexes

### Performance Indexes
```sql
-- User lookups
CREATE INDEX idx_scores_user_id ON scores(user_id);

-- Game lookups
CREATE INDEX idx_scores_game_id ON scores(game_id);

-- League game queries
CREATE INDEX idx_games_league_id ON games(league_id);

-- League player queries
CREATE INDEX idx_league_players_league ON league_players(league_id);
CREATE INDEX idx_league_players_user ON league_players(user_id);

-- User authentication
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
```

## Sample Queries

### Get League Statistics
```sql
SELECT 
    u.id as user_id,
    u.username,
    lp.player_color,
    AVG(s.placement) as avg_placement,
    COUNT(CASE WHEN s.placement = 1 THEN 1 END) as first_place_finishes,
    AVG(s.total_score) as average_score,
    AVG(s.birds) as avg_birds,
    AVG(s.bonus_cards) as avg_bonus_cards,
    AVG(s.end_of_round_goals) as avg_end_of_round_goals,
    AVG(s.eggs) as avg_eggs,
    AVG(s.food_on_cards) as avg_food_on_cards,
    AVG(s.tucked_cards) as avg_tucked_cards,
    AVG(s.nectar) as avg_nectar,
    COUNT(s.id) as total_games,
    COUNT(CASE WHEN s.placement = 1 THEN 1 END) as wins,
    COUNT(CASE WHEN s.placement != 1 THEN 1 END) as losses
FROM 
    league_players lp
    JOIN users u ON lp.user_id = u.id
    LEFT JOIN scores s ON s.user_id = u.id
    LEFT JOIN games g ON s.game_id = g.id AND g.league_id = lp.league_id
WHERE 
    lp.league_id = ?
GROUP BY 
    u.id, u.username, lp.player_color
ORDER BY 
    avg_placement ASC, average_score DESC;
```

### Get Game History
```sql
SELECT 
    g.id,
    g.played_at,
    s.user_id,
    s.total_score,
    s.placement
FROM 
    games g
    JOIN scores s ON s.game_id = g.id
WHERE 
    g.league_id = ?
ORDER BY 
    g.played_at DESC
LIMIT ? OFFSET ?;
```

### Get User's Leagues
```sql
SELECT 
    l.id,
    l.name,
    l.created_at,
    COUNT(DISTINCT lp.user_id) as player_count,
    MAX(g.played_at) as last_game_date
FROM 
    leagues l
    JOIN league_players lp ON l.id = lp.league_id
    LEFT JOIN games g ON g.league_id = l.id
WHERE 
    lp.user_id = ?
GROUP BY 
    l.id, l.name, l.created_at
ORDER BY 
    last_game_date DESC NULLS LAST;
```

## Database Initialization Script

```sql
-- Enable foreign keys
PRAGMA foreign_keys = ON;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Leagues table
CREATE TABLE IF NOT EXISTS leagues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- League players junction table
CREATE TABLE IF NOT EXISTS league_players (
    league_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    player_color TEXT CHECK(player_color IN ('player_1', 'player_2', 'player_3')),
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (league_id, user_id),
    FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Games table
CREATE TABLE IF NOT EXISTS games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    league_id INTEGER NOT NULL,
    played_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER NOT NULL,
    FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Scores table
CREATE TABLE IF NOT EXISTS scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    placement INTEGER NOT NULL CHECK (placement IN (1, 2, 3)),
    total_score INTEGER NOT NULL,
    birds INTEGER DEFAULT 0,
    bonus_cards INTEGER DEFAULT 0,
    end_of_round_goals INTEGER DEFAULT 0,
    eggs INTEGER DEFAULT 0,
    food_on_cards INTEGER DEFAULT 0,
    tucked_cards INTEGER DEFAULT 0,
    nectar INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(game_id, user_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_scores_user_id ON scores(user_id);
CREATE INDEX IF NOT EXISTS idx_scores_game_id ON scores(game_id);
CREATE INDEX IF NOT EXISTS idx_games_league_id ON games(league_id);
CREATE INDEX IF NOT EXISTS idx_league_players_league ON league_players(league_id);
CREATE INDEX IF NOT EXISTS idx_league_players_user ON league_players(user_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
```

## Data Migration Strategy

### Version 1.0 (Initial)
- All tables as defined above
- Basic indexes
- Foreign key constraints

### Future Migrations
- Add `updated_at` triggers for automatic timestamp updates
- Add soft delete columns if needed
- Add audit logging table if needed
- Add indexes based on query performance analysis

## Backup Strategy

### SQLite Backup Methods
1. **File Copy**: Simple file copy of `.db` file (for small databases)
2. **SQL Dump**: Export all data to SQL file
3. **Incremental Backup**: Track changes and backup only modified data

### Recommended Approach
- Daily automated backups of database file
- Weekly SQL dumps for long-term storage
- Backup before schema migrations

---

This schema design provides a lightweight, efficient database structure optimized for the Wingspan Score Tracker application's requirements.
