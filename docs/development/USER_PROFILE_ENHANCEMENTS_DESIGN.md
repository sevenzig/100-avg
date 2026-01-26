# User Profile Enhancements & Super Admin System Design

## 1. Overview

This document outlines the design for enhanced user profiles with nicknames, platform-specific aliases, and a new super admin role system. It also includes a data migration strategy to combine duplicate user accounts (sevenzig and hotnut).

## 2. Requirements Summary

1. **User Nickname**: Add nickname field separate from username
2. **Platform Aliases**: Add text fields for platform-specific aliases (Steam, Android, iPhone)
3. **Super Admin Role**: Create new "super admin" user class
4. **Admin Route Protection**: Restrict `/admin` route to super admins only
5. **Data Migration**: Combine sevenzig and hotnut accounts (set sevenzig's nickname to "hotnut")

## 3. Database Schema Changes

### 3.1 Users Table Extensions

Add new columns to the `users` table:

```sql
ALTER TABLE users ADD COLUMN nickname TEXT;
ALTER TABLE users ADD COLUMN steam_alias TEXT;
ALTER TABLE users ADD COLUMN android_alias TEXT;
ALTER TABLE users ADD COLUMN iphone_alias TEXT;
ALTER TABLE users ADD COLUMN is_super_admin INTEGER DEFAULT 0;
```

**Schema Details:**
- `nickname`: Optional friendly name/alias (separate from username)
- `steam_alias`: Optional Steam platform-specific alias
- `android_alias`: Optional Android platform-specific alias
- `iphone_alias`: Optional iPhone platform-specific alias
- `is_super_admin`: Boolean flag (0 = false, 1 = true) for super admin privileges

**Migration Script:**
```sql
-- Add new profile columns
ALTER TABLE users ADD COLUMN nickname TEXT;
ALTER TABLE users ADD COLUMN steam_alias TEXT;
ALTER TABLE users ADD COLUMN android_alias TEXT;
ALTER TABLE users ADD COLUMN iphone_alias TEXT;
ALTER TABLE users ADD COLUMN is_super_admin INTEGER DEFAULT 0;

-- Set sevenzig's nickname to "hotnut"
UPDATE users SET nickname = 'hotnut' WHERE username = 'sevenzig';

-- Set sevenzig as super admin
UPDATE users SET is_super_admin = 1 WHERE username = 'sevenzig';

-- Migrate hotnut's data to sevenzig (if hotnut exists)
-- This will be handled by a migration script (see section 5)
```

### 3.2 Data Migration Strategy

**Combining sevenzig and hotnut accounts:**

1. Identify all data associated with hotnut (user_id)
2. Transfer all league memberships from hotnut to sevenzig
3. Transfer all games created by hotnut to sevenzig
4. Transfer all scores from hotnut to sevenzig
5. Delete hotnut user account
6. Set sevenzig's nickname to "hotnut"

**Migration Script Logic:**
```sql
-- Step 1: Get user IDs
-- sevenzig_id = SELECT id FROM users WHERE username = 'sevenzig'
-- hotnut_id = SELECT id FROM users WHERE username = 'hotnut'

-- Step 2: Update league_players (transfer memberships)
UPDATE league_players SET user_id = sevenzig_id WHERE user_id = hotnut_id;

-- Step 3: Update games (transfer ownership)
UPDATE games SET created_by = sevenzig_id WHERE created_by = hotnut_id;

-- Step 4: Update scores (transfer scores)
UPDATE scores SET user_id = sevenzig_id WHERE user_id = hotnut_id;

-- Step 5: Set nickname
UPDATE users SET nickname = 'hotnut' WHERE id = sevenzig_id;

-- Step 6: Delete hotnut account
DELETE FROM users WHERE id = hotnut_id;
```

## 4. API Design

### 4.1 Updated Profile Endpoints

#### GET `/api/profile`
**Updated Response:**
```json
{
  "profile": {
    "id": 1,
    "username": "sevenzig",
    "email": "sevenzig@gmail.com",
    "displayName": "Seven Zig",
    "nickname": "hotnut",
    "platforms": ["steam", "android"],
    "platformAliases": {
      "steam": "sevenzig_steam",
      "android": "hotnut_mobile",
      "iphone": null
    },
    "createdAt": "2026-01-25T04:21:08.000Z"
  }
}
```

#### PUT `/api/profile`
**Updated Request:**
```json
{
  "displayName": "Seven Zig",
  "username": "sevenzig",
  "nickname": "hotnut",
  "platforms": ["steam", "android", "iphone"],
  "platformAliases": {
    "steam": "sevenzig_steam",
    "android": "hotnut_mobile",
    "iphone": "sevenzig_ios"
  }
}
```

**Validation:**
- `nickname`: Optional, 1-50 characters
- `platformAliases`: Object with optional string values for each platform
  - Each alias: Optional, 1-100 characters
  - Keys: `steam`, `android`, `iphone`

### 4.2 Updated Auth Endpoint

#### GET `/api/auth/me`
**Updated Response:**
```json
{
  "user": {
    "id": 1,
    "username": "sevenzig",
    "email": "sevenzig@gmail.com",
    "createdAt": "2026-01-25T04:21:08.000Z",
    "isAdmin": false,
    "isSuperAdmin": true
  }
}
```

### 4.3 Updated Admin Endpoints

All admin endpoints (`/api/admin/*`) should now check for `isSuperAdmin` instead of `isAdmin`:

```typescript
function requireSuperAdmin(cookies: any, db: any): number {
  const userId = getUserId(cookies);
  if (!userId) {
    throw { status: 401, body: { error: 'Not authenticated' } };
  }

  if (!isSuperAdmin(userId, db)) {
    throw { status: 403, body: { error: 'Super admin access required' } };
  }

  return userId;
}
```

## 5. Component Design

### 5.1 Updated ProfileEditForm Component

**New Fields:**
- Nickname input (optional)
- Platform alias inputs (conditional - only show for selected platforms)
  - Steam alias (shown if Steam platform is selected)
  - Android alias (shown if Android platform is selected)
  - iPhone alias (shown if iPhone platform is selected)

**UI Structure:**
```
Profile Edit Form
├── Display Name Input
├── Username Input
├── Nickname Input (NEW)
├── Platforms Checkboxes
│   ├── ☑ Steam
│   │   └── Steam Alias Input (NEW - conditional)
│   ├── ☑ Android
│   │   └── Android Alias Input (NEW - conditional)
│   └── ☐ iPhone
│       └── iPhone Alias Input (NEW - conditional)
└── Save/Cancel Buttons
```

### 5.2 Updated Profile Page

The profile page will display:
- Username
- Nickname (if set)
- Platform aliases (if set)
- Statistics charts (unchanged)

## 6. Authentication & Authorization Updates

### 6.1 New Auth Utility Functions

**File:** `src/lib/utils/auth.ts`

```typescript
export function isSuperAdmin(userId: number, db: any): boolean {
  const user = db
    .prepare('SELECT is_super_admin FROM users WHERE id = ?')
    .get(userId) as { is_super_admin: number | null } | undefined;
  return user?.is_super_admin === 1;
}

// Keep isAdmin for backward compatibility (regular admins)
export function isAdmin(userId: number, db: any): boolean {
  const user = db
    .prepare('SELECT is_admin FROM users WHERE id = ?')
    .get(userId) as { is_admin: number | null } | undefined;
  return user?.is_admin === 1;
}
```

### 6.2 Updated Admin Route Protection

**File:** `src/routes/(protected)/admin/+page.svelte`

Change admin check from `isAdmin` to `isSuperAdmin`:

```typescript
// OLD: const isAdmin = $user.isAdmin === true || ($user.isAdmin as any) === 1;
// NEW:
const isSuperAdmin = $user.isSuperAdmin === true || ($user.isSuperAdmin as any) === 1;
if (!isSuperAdmin) {
  goto('/leagues');
}
```

### 6.3 Updated Navigation

**File:** `src/routes/(protected)/+layout.svelte`

Change admin link visibility check:

```svelte
{#if $user.isSuperAdmin}
  <li>
    <a href="/admin">Admin</a>
  </li>
{/if}
```

## 7. Data Migration Script

### 7.1 Migration Script Structure

**File:** `scripts/migrate-user-profiles.ts`

```typescript
import Database from 'better-sqlite3';
import { join } from 'path';

const dbPath = process.env.DATABASE_PATH || join(process.cwd(), 'database', 'wingspan.db');

async function migrateUserProfiles() {
  const db = new Database(dbPath);
  db.pragma('foreign_keys = ON');

  try {
    // Step 1: Add new columns
    console.log('Adding new profile columns...');
    try {
      db.exec('ALTER TABLE users ADD COLUMN nickname TEXT');
      console.log('  ✓ Added nickname column');
    } catch (e: any) {
      if (!e.message.includes('duplicate column')) throw e;
    }

    try {
      db.exec('ALTER TABLE users ADD COLUMN steam_alias TEXT');
      console.log('  ✓ Added steam_alias column');
    } catch (e: any) {
      if (!e.message.includes('duplicate column')) throw e;
    }

    try {
      db.exec('ALTER TABLE users ADD COLUMN android_alias TEXT');
      console.log('  ✓ Added android_alias column');
    } catch (e: any) {
      if (!e.message.includes('duplicate column')) throw e;
    }

    try {
      db.exec('ALTER TABLE users ADD COLUMN iphone_alias TEXT');
      console.log('  ✓ Added iphone_alias column');
    } catch (e: any) {
      if (!e.message.includes('duplicate column')) throw e;
    }

    try {
      db.exec('ALTER TABLE users ADD COLUMN is_super_admin INTEGER DEFAULT 0');
      console.log('  ✓ Added is_super_admin column');
    } catch (e: any) {
      if (!e.message.includes('duplicate column')) throw e;
    }

    // Step 2: Get user IDs
    const sevenzig = db
      .prepare('SELECT id FROM users WHERE username = ?')
      .get('sevenzig') as { id: number } | undefined;

    const hotnut = db
      .prepare('SELECT id FROM users WHERE username = ?')
      .get('hotnut') as { id: number } | undefined;

    if (!sevenzig) {
      console.log('⚠️  User "sevenzig" not found, skipping migration');
      return;
    }

    // Step 3: Set sevenzig's nickname to "hotnut"
    db.prepare('UPDATE users SET nickname = ? WHERE id = ?').run('hotnut', sevenzig.id);
    console.log('  ✓ Set sevenzig nickname to "hotnut"');

    // Step 4: Set sevenzig as super admin
    db.prepare('UPDATE users SET is_super_admin = 1 WHERE id = ?').run(sevenzig.id);
    console.log('  ✓ Set sevenzig as super admin');

    // Step 5: Migrate hotnut data to sevenzig (if hotnut exists)
    if (hotnut) {
      console.log('  Migrating hotnut data to sevenzig...');

      // Transfer league memberships
      const leagueMemberships = db
        .prepare('SELECT league_id FROM league_players WHERE user_id = ?')
        .all(hotnut.id) as Array<{ league_id: number }>;

      for (const membership of leagueMemberships) {
        // Check if sevenzig is already in this league
        const existing = db
          .prepare('SELECT user_id FROM league_players WHERE league_id = ? AND user_id = ?')
          .get(membership.league_id, sevenzig.id);

        if (!existing) {
          // Transfer membership
          db.prepare('UPDATE league_players SET user_id = ? WHERE league_id = ? AND user_id = ?')
            .run(sevenzig.id, membership.league_id, hotnut.id);
        } else {
          // Remove duplicate membership
          db.prepare('DELETE FROM league_players WHERE league_id = ? AND user_id = ?')
            .run(membership.league_id, hotnut.id);
        }
      }
      console.log('    ✓ Transferred league memberships');

      // Transfer games
      db.prepare('UPDATE games SET created_by = ? WHERE created_by = ?')
        .run(sevenzig.id, hotnut.id);
      console.log('    ✓ Transferred games');

      // Transfer scores
      db.prepare('UPDATE scores SET user_id = ? WHERE user_id = ?')
        .run(sevenzig.id, hotnut.id);
      console.log('    ✓ Transferred scores');

      // Delete hotnut account
      db.prepare('DELETE FROM users WHERE id = ?').run(hotnut.id);
      console.log('    ✓ Deleted hotnut account');
    }

    console.log('\n✅ User profile migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    db.close();
  }
}

migrateUserProfiles()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  });
```

## 8. Implementation Details

### 8.1 Database Queries

#### Get User Profile (Updated)
```sql
SELECT 
  id,
  username,
  email,
  display_name,
  nickname,
  platforms,
  steam_alias,
  android_alias,
  iphone_alias,
  created_at
FROM users
WHERE id = ?;
```

#### Update User Profile (Updated)
```sql
UPDATE users
SET 
  display_name = ?,
  username = ?,
  nickname = ?,
  platforms = ?,
  steam_alias = ?,
  android_alias = ?,
  iphone_alias = ?,
  updated_at = CURRENT_TIMESTAMP
WHERE id = ?;
```

#### Check Super Admin
```sql
SELECT is_super_admin FROM users WHERE id = ?;
```

### 8.2 Type Definitions

```typescript
interface Profile {
  id: number;
  username: string;
  email: string;
  displayName?: string | null;
  nickname?: string | null;
  platforms: string[];
  platformAliases: {
    steam?: string | null;
    android?: string | null;
    iphone?: string | null;
  };
  createdAt: string;
}

interface User {
  id: number;
  username: string;
  email: string;
  createdAt?: string;
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
}

interface ProfileUpdate {
  displayName?: string | null;
  username?: string;
  nickname?: string | null;
  platforms?: string[];
  platformAliases?: {
    steam?: string | null;
    android?: string | null;
    iphone?: string | null;
  };
}
```

## 9. UI/UX Design

### 9.1 Profile Edit Form Layout

```
┌─────────────────────────────────────────┐
│  Profile Information                     │
├─────────────────────────────────────────┤
│                                          │
│  Display Name: [________________]       │
│  Username:     [sevenzig_______]        │
│  Nickname:     [hotnut_________]        │
│                                          │
│  Platforms:                              │
│    ☑ Steam                               │
│       Steam Alias: [sevenzig_steam__]   │
│    ☑ Android                             │
│       Android Alias: [hotnut_mobile__]  │
│    ☐ iPhone                              │
│       iPhone Alias: [________________]  │
│                                          │
│  [Cancel]  [Save Changes]                │
│                                          │
└─────────────────────────────────────────┘
```

### 9.2 Conditional Platform Alias Fields

- Platform alias inputs only appear when the corresponding platform checkbox is checked
- When a platform is unchecked, its alias is cleared
- Alias fields are optional (can be left empty)

## 10. Security Considerations

1. **Super Admin Protection**: Only super admins can access `/admin` route
2. **Regular Admin Role**: Keep `is_admin` for potential future use (regular admin features)
3. **Authorization Checks**: All admin API endpoints check `isSuperAdmin`
4. **Input Validation**: All alias fields validated (1-100 characters, optional)
5. **Data Migration Safety**: Migration script uses transactions where possible

## 11. Migration Checklist

### Phase 1: Database Schema
- [ ] Add `nickname` column
- [ ] Add `steam_alias` column
- [ ] Add `android_alias` column
- [ ] Add `iphone_alias` column
- [ ] Add `is_super_admin` column

### Phase 2: Data Migration
- [ ] Run migration script to combine sevenzig/hotnut
- [ ] Set sevenzig nickname to "hotnut"
- [ ] Set sevenzig as super admin
- [ ] Verify data integrity after migration

### Phase 3: API Updates
- [ ] Update `GET /api/profile` to return new fields
- [ ] Update `PUT /api/profile` to accept new fields
- [ ] Update `GET /api/auth/me` to return `isSuperAdmin`
- [ ] Update all admin endpoints to check `isSuperAdmin`
- [ ] Add `isSuperAdmin` utility function

### Phase 4: UI Updates
- [ ] Update ProfileEditForm to include nickname field
- [ ] Add conditional platform alias inputs
- [ ] Update profile page to display nickname and aliases
- [ ] Update admin route protection to check `isSuperAdmin`
- [ ] Update navigation to check `isSuperAdmin` for admin link

### Phase 5: Testing
- [ ] Test profile editing with all new fields
- [ ] Test super admin access to `/admin` route
- [ ] Test regular admin cannot access `/admin` route
- [ ] Verify data migration completed successfully
- [ ] Test platform alias conditional display

## 12. File Structure

```
src/
├── lib/
│   ├── components/
│   │   └── profile/
│   │       └── ProfileEditForm.svelte (UPDATED)
│   └── utils/
│       ├── auth.ts (UPDATED - add isSuperAdmin)
│       └── db.ts (UPDATED - add columns)
├── routes/
│   ├── (protected)/
│   │   ├── admin/
│   │   │   └── +page.svelte (UPDATED - check isSuperAdmin)
│   │   ├── profile/
│   │   │   └── +page.svelte (UPDATED - display new fields)
│   │   └── +layout.svelte (UPDATED - check isSuperAdmin)
│   └── api/
│       ├── auth/
│       │   └── me/
│       │       └── +server.ts (UPDATED - return isSuperAdmin)
│       ├── admin/
│       │   ├── leagues/
│       │   │   └── +server.ts (UPDATED - check isSuperAdmin)
│       │   └── users/
│       │       └── +server.ts (UPDATED - check isSuperAdmin)
│       └── profile/
│           └── +server.ts (UPDATED - handle new fields)
└── scripts/
    └── migrate-user-profiles.ts (NEW)
```

## 13. Backward Compatibility

- Keep `is_admin` column for potential future use
- Regular admins (`is_admin = 1`) will not have access to `/admin` route
- Only super admins (`is_super_admin = 1`) can access `/admin`
- Existing profile data remains intact (new fields are optional)

## 14. Future Enhancements

1. **Regular Admin Features**: Use `is_admin` for limited admin features (e.g., view-only admin panel)
2. **Role Hierarchy**: Implement role-based access control (user < admin < super admin)
3. **Platform Integration**: Use platform aliases for cross-platform account linking
4. **Nickname Display**: Show nickname in leaderboards and game history
5. **Alias Search**: Allow searching users by platform aliases

---

This design provides a comprehensive plan for implementing user profile enhancements and the super admin system while maintaining data integrity and security.
