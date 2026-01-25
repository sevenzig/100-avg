# API Documentation

## Base URL
All API endpoints are prefixed with `/api`

## Authentication
Most endpoints require authentication via JWT token stored in httpOnly cookie.

---

## Authentication Endpoints

### POST /api/auth/register
Register a new user account.

**Request Body**:
```json
{
  "username": "string (required, 3-20 chars, alphanumeric)",
  "email": "string (required, valid email format)",
  "password": "string (required, min 8 chars)"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "user": {
    "id": 1,
    "username": "player1",
    "email": "player1@example.com"
  }
}
```

**Error Response** (400 Bad Request):
```json
{
  "success": false,
  "error": "Username already exists"
}
```

**Error Response** (500 Internal Server Error):
```json
{
  "success": false,
  "error": "Internal server error"
}
```

---

### POST /api/auth/login
Authenticate user and create session.

**Request Body**:
```json
{
  "username": "string (required)", // Can be username or email
  "password": "string (required)"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "token": "jwt-token-string",
  "user": {
    "id": 1,
    "username": "player1",
    "email": "player1@example.com"
  }
}
```

**Error Response** (401 Unauthorized):
```json
{
  "success": false,
  "error": "Invalid credentials"
}
```

**Notes**:
- Token is set as httpOnly cookie automatically
- Token expires in 7 days
- Token should be included in subsequent requests via cookie

---

### POST /api/auth/logout
Logout current user and invalidate session.

**Request**: No body required

**Response** (200 OK):
```json
{
  "success": true
}
```

**Notes**:
- Clears authentication cookie
- Invalidates token on server side (if token blacklist implemented)

---

### GET /api/auth/me
Get current authenticated user information.

**Request**: No body required (uses cookie for auth)

**Response** (200 OK):
```json
{
  "user": {
    "id": 1,
    "username": "player1",
    "email": "player1@example.com",
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

**Error Response** (401 Unauthorized):
```json
{
  "error": "Not authenticated"
}
```

---

## League Endpoints

### GET /api/leagues
Get all leagues for the authenticated user.

**Request**: No body required

**Response** (200 OK):
```json
{
  "leagues": [
    {
      "id": 1,
      "name": "Weekend Warriors",
      "playerCount": 3,
      "lastGameDate": "2024-01-20T15:00:00Z",
      "players": [
        {
          "id": 1,
          "username": "player1",
          "color": "player_1"
        },
        {
          "id": 2,
          "username": "player2",
          "color": "player_2"
        },
        {
          "id": 3,
          "username": "player3",
          "color": "player_3"
        }
      ]
    }
  ]
}
```

**Notes**:
- Only returns leagues where user is a member
- Ordered by last game date (most recent first)
- Includes player information

---

### POST /api/leagues
Create a new league.

**Request Body**:
```json
{
  "name": "string (required, 1-50 chars)",
  "playerIds": [1, 2, 3] // Array of user IDs, exactly 3 required
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "league": {
    "id": 5,
    "name": "Weekend Warriors",
    "createdBy": 1,
    "createdAt": "2024-01-20T10:00:00Z"
  }
}
```

**Error Response** (400 Bad Request):
```json
{
  "success": false,
  "error": "League must have exactly 3 players"
}
```

**Validation Rules**:
- League name: Required, 1-50 characters
- Player IDs: Exactly 3 unique user IDs
- Creator must be one of the players
- All player IDs must exist

---

### GET /api/leagues/[id]
Get detailed information about a specific league.

**Request**: No body required

**Response** (200 OK):
```json
{
  "league": {
    "id": 1,
    "name": "Weekend Warriors",
    "createdBy": 1,
    "createdAt": "2024-01-15T10:00:00Z",
    "players": [
      {
        "id": 1,
        "username": "player1",
        "color": "player_1"
      },
      {
        "id": 2,
        "username": "player2",
        "color": "player_2"
      },
      {
        "id": 3,
        "username": "player3",
        "color": "player_3"
      }
    ],
    "games": [
      {
        "id": 10,
        "playedAt": "2024-01-20T15:00:00Z"
      },
      {
        "id": 9,
        "playedAt": "2024-01-18T14:00:00Z"
      }
    ]
  }
}
```

**Error Response** (403 Forbidden):
```json
{
  "error": "You are not a member of this league"
}
```

**Error Response** (404 Not Found):
```json
{
  "error": "League not found"
}
```

---

## Statistics Endpoints

### GET /api/leagues/[id]/stats
Get comprehensive statistics for all players in a league.

**Request**: No body required

**Response** (200 OK):
```json
{
  "stats": [
    {
      "userId": 1,
      "username": "player1",
      "color": "player_1",
      "avgPlacement": 1.8,
      "firstPlaceFinishes": 5,
      "averageScore": 87.5,
      "avgBreakdown": {
        "birds": 45.2,
        "bonusCards": 12.3,
        "endOfRoundGoals": 8.5,
        "eggs": 6.2,
        "foodOnCards": 4.1,
        "tuckedCards": 3.8,
        "nectar": 7.4
      },
      "totalGames": 10,
      "wins": 5,
      "losses": 5
    },
    {
      "userId": 2,
      "username": "player2",
      "color": "player_2",
      "avgPlacement": 2.1,
      "firstPlaceFinishes": 3,
      "averageScore": 82.3,
      "avgBreakdown": {
        "birds": 42.1,
        "bonusCards": 11.5,
        "endOfRoundGoals": 7.8,
        "eggs": 5.9,
        "foodOnCards": 3.8,
        "tuckedCards": 3.2,
        "nectar": 8.0
      },
      "totalGames": 10,
      "wins": 3,
      "losses": 7
    },
    {
      "userId": 3,
      "username": "player3",
      "color": "player_3",
      "avgPlacement": 2.1,
      "firstPlaceFinishes": 2,
      "averageScore": 79.8,
      "avgBreakdown": {
        "birds": 40.5,
        "bonusCards": 10.2,
        "endOfRoundGoals": 7.2,
        "eggs": 5.5,
        "foodOnCards": 3.5,
        "tuckedCards": 2.9,
        "nectar": 10.0
      },
      "totalGames": 10,
      "wins": 2,
      "losses": 8
    }
  ]
}
```

**Calculation Notes**:
- `avgPlacement`: Average of all placements (1, 2, or 3)
- `firstPlaceFinishes`: Count of games where placement = 1
- `averageScore`: Mean of all total scores
- `avgBreakdown`: Mean of each scoring category
- `wins`: Games where placement = 1
- `losses`: Games where placement != 1

**Error Response** (403 Forbidden):
```json
{
  "error": "You are not a member of this league"
}
```

---

## Game Endpoints

### POST /api/games
Create a new game record with scores.

**Request Body**:
```json
{
  "leagueId": 1,
  "playedAt": "2024-01-20T15:00:00Z", // ISO 8601 date string
  "scores": [
    {
      "userId": 1,
      "placement": 1,
      "totalScore": 95,
      "birds": 48,
      "bonusCards": 15,
      "endOfRoundGoals": 10,
      "eggs": 8,
      "foodOnCards": 5,
      "tuckedCards": 4,
      "nectar": 5
    },
    {
      "userId": 2,
      "placement": 2,
      "totalScore": 88,
      "birds": 45,
      "bonusCards": 12,
      "endOfRoundGoals": 8,
      "eggs": 7,
      "foodOnCards": 4,
      "tuckedCards": 3,
      "nectar": 9
    },
    {
      "userId": 3,
      "placement": 3,
      "totalScore": 82,
      "birds": 42,
      "bonusCards": 10,
      "endOfRoundGoals": 7,
      "eggs": 6,
      "foodOnCards": 3,
      "tuckedCards": 2,
      "nectar": 12
    }
  ]
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "game": {
    "id": 15,
    "leagueId": 1,
    "playedAt": "2024-01-20T15:00:00Z",
    "createdBy": 1
  }
}
```

**Error Response** (400 Bad Request):
```json
{
  "success": false,
  "error": "Game must have exactly 3 scores"
}
```

**Error Response** (400 Bad Request):
```json
{
  "success": false,
  "error": "Placements must be 1, 2, and 3"
}
```

**Error Response** (400 Bad Request):
```json
{
  "success": false,
  "error": "Total score does not match sum of breakdown"
}
```

**Validation Rules**:
- Exactly 3 scores required
- All 3 players must be members of the league
- Placements must be exactly 1, 2, and 3 (unique)
- Total score must equal sum of all breakdown categories
- All breakdown values must be non-negative integers
- `playedAt` must be valid ISO 8601 date

---

### GET /api/games/[id]
Get detailed information about a specific game.

**Request**: No body required

**Response** (200 OK):
```json
{
  "game": {
    "id": 15,
    "leagueId": 1,
    "playedAt": "2024-01-20T15:00:00Z",
    "createdBy": 1,
    "scores": [
      {
        "userId": 1,
        "username": "player1",
        "placement": 1,
        "totalScore": 95,
        "breakdown": {
          "birds": 48,
          "bonusCards": 15,
          "endOfRoundGoals": 10,
          "eggs": 8,
          "foodOnCards": 5,
          "tuckedCards": 4,
          "nectar": 5
        }
      },
      {
        "userId": 2,
        "username": "player2",
        "placement": 2,
        "totalScore": 88,
        "breakdown": {
          "birds": 45,
          "bonusCards": 12,
          "endOfRoundGoals": 8,
          "eggs": 7,
          "foodOnCards": 4,
          "tuckedCards": 3,
          "nectar": 9
        }
      },
      {
        "userId": 3,
        "username": "player3",
        "placement": 3,
        "totalScore": 82,
        "breakdown": {
          "birds": 42,
          "bonusCards": 10,
          "endOfRoundGoals": 7,
          "eggs": 6,
          "foodOnCards": 3,
          "tuckedCards": 2,
          "nectar": 12
        }
      }
    ]
  }
}
```

**Error Response** (403 Forbidden):
```json
{
  "error": "You are not a member of this league"
}
```

**Error Response** (404 Not Found):
```json
{
  "error": "Game not found"
}
```

---

### GET /api/leagues/[id]/games
Get all games for a league (for history/charts).

**Request Query Parameters**:
- `limit`: number (optional, default: 50, max: 100)
- `offset`: number (optional, default: 0)

**Response** (200 OK):
```json
{
  "games": [
    {
      "id": 15,
      "playedAt": "2024-01-20T15:00:00Z",
      "scores": [
        {
          "userId": 1,
          "totalScore": 95
        },
        {
          "userId": 2,
          "totalScore": 88
        },
        {
          "userId": 3,
          "totalScore": 82
        }
      ]
    }
  ],
  "total": 10,
  "limit": 50,
  "offset": 0
}
```

**Notes**:
- Ordered by `playedAt` descending (most recent first)
- Includes pagination metadata
- Only includes total scores (not full breakdown) for performance

---

## Error Handling

All endpoints follow consistent error response format:

**Standard Error Response**:
```json
{
  "success": false,
  "error": "Error message describing what went wrong"
}
```

**HTTP Status Codes**:
- `200 OK`: Successful request
- `201 Created`: Resource created successfully
- `400 Bad Request`: Invalid request data or validation error
- `401 Unauthorized`: Authentication required or invalid
- `403 Forbidden`: Authenticated but not authorized for resource
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server error

---

## Rate Limiting

Authentication endpoints are rate-limited:
- `/api/auth/login`: 5 requests per 15 minutes per IP
- `/api/auth/register`: 3 requests per hour per IP

---

## CORS

CORS is configured to allow requests from the same origin only in production. Development allows localhost.

---

## Data Validation

All input data is validated on the server side:
- Type checking
- Format validation (email, date, etc.)
- Range validation (scores, counts, etc.)
- Business rule validation (exactly 3 players, unique placements, etc.)

---

## Database Constraints

The database enforces:
- Unique usernames and emails
- Foreign key constraints
- Check constraints (placement values, etc.)
- NOT NULL constraints on required fields

---

This API documentation provides complete interface specifications for all endpoints in the Wingspan Score Tracker application.
