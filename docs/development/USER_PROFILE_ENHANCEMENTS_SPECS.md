# User Profile Enhancements - Component Specifications

## Component Updates

### 1. ProfileEditForm Component Updates

**File:** `src/lib/components/profile/ProfileEditForm.svelte`

**New Props:**
```typescript
export let profile: {
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
};
```

**New State:**
```typescript
let nickname = '';
let steamAlias = '';
let androidAlias = '';
let iphoneAlias = '';
```

**Updated Validation:**
```typescript
function validateForm(): boolean {
  // ... existing validation ...

  // Validate nickname
  if (nickname && nickname.length > 50) {
    formError = 'Nickname must be 50 characters or less';
    return false;
  }

  // Validate platform aliases
  const aliasFields = [
    { platform: 'steam', value: steamAlias },
    { platform: 'android', value: androidAlias },
    { platform: 'iphone', value: iphoneAlias }
  ];

  for (const { platform, value } of aliasFields) {
    if (value && value.length > 100) {
      formError = `${platform.charAt(0).toUpperCase() + platform.slice(1)} alias must be 100 characters or less`;
      return false;
    }
  }

  return true;
}
```

**Updated Submit Handler:**
```typescript
function handleSubmit() {
  if (!validateForm()) {
    return;
  }

  const platformAliases: Record<string, string | null> = {};
  
  if (platforms.includes('steam')) {
    platformAliases.steam = steamAlias.trim() || null;
  }
  if (platforms.includes('android')) {
    platformAliases.android = androidAlias.trim() || null;
  }
  if (platforms.includes('iphone')) {
    platformAliases.iphone = iphoneAlias.trim() || null;
  }

  dispatch('save', {
    profile: {
      displayName: displayName.trim() || null,
      username: username.trim(),
      nickname: nickname.trim() || null,
      platforms: [...platforms],
      platformAliases
    }
  });
}
```

**Updated UI Structure:**
```svelte
<form on:submit|preventDefault={handleSubmit} class="space-y-4">
  <Input
    label="Display Name"
    bind:value={displayName}
    placeholder="Optional friendly name"
  />

  <Input
    label="Username"
    bind:value={username}
    placeholder="Your username"
    required
  />

  <Input
    label="Nickname"
    bind:value={nickname}
    placeholder="Optional nickname (e.g., hotnut)"
  />

  <div class="form-control">
    <label class="block text-sm font-medium text-slate-700 mb-2">
      Platforms
    </label>
    <div class="space-y-3">
      <!-- Steam -->
      <div class="space-y-2">
        <label class="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-2 rounded">
          <input
            type="checkbox"
            checked={platforms.includes('steam')}
            on:change={() => togglePlatform('steam')}
            class="checkbox checkbox-sm"
          />
          <span class="text-sm text-slate-700">Steam</span>
        </label>
        {#if platforms.includes('steam')}
          <div class="ml-6">
            <Input
              label="Steam Alias"
              bind:value={steamAlias}
              placeholder="Your Steam username/alias"
              className="text-sm"
            />
          </div>
        {/if}
      </div>

      <!-- Android -->
      <div class="space-y-2">
        <label class="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-2 rounded">
          <input
            type="checkbox"
            checked={platforms.includes('android')}
            on:change={() => togglePlatform('android')}
            class="checkbox checkbox-sm"
          />
          <span class="text-sm text-slate-700">Android</span>
        </label>
        {#if platforms.includes('android')}
          <div class="ml-6">
            <Input
              label="Android Alias"
              bind:value={androidAlias}
              placeholder="Your Android username/alias"
              className="text-sm"
            />
          </div>
        {/if}
      </div>

      <!-- iPhone -->
      <div class="space-y-2">
        <label class="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-2 rounded">
          <input
            type="checkbox"
            checked={platforms.includes('iphone')}
            on:change={() => togglePlatform('iphone')}
            class="checkbox checkbox-sm"
          />
          <span class="text-sm text-slate-700">iPhone</span>
        </label>
        {#if platforms.includes('iphone')}
          <div class="ml-6">
            <Input
              label="iPhone Alias"
              bind:value={iphoneAlias}
              placeholder="Your iPhone username/alias"
              className="text-sm"
            />
          </div>
        {/if}
      </div>
    </div>
  </div>

  <!-- Error display and buttons -->
</form>
```

**Platform Toggle with Alias Clearing:**
```typescript
function togglePlatform(platform: string) {
  if (platforms.includes(platform)) {
    platforms = platforms.filter((p) => p !== platform);
    // Clear alias when platform is unchecked
    if (platform === 'steam') steamAlias = '';
    if (platform === 'android') androidAlias = '';
    if (platform === 'iphone') iphoneAlias = '';
  } else {
    platforms = [...platforms, platform];
  }
}
```

### 2. Profile Page Updates

**File:** `src/routes/(protected)/profile/+page.svelte`

**Updated Profile Display:**
```svelte
{#if profile}
  <Card>
    <div slot="header">
      <h2 class="text-xl font-semibold text-slate-900">Profile Information</h2>
    </div>
    <div class="space-y-4">
      <div>
        <p class="text-sm text-slate-600">Username</p>
        <p class="text-lg font-medium text-slate-900">{profile.username}</p>
      </div>
      {#if profile.nickname}
        <div>
          <p class="text-sm text-slate-600">Nickname</p>
          <p class="text-lg font-medium text-slate-900">{profile.nickname}</p>
        </div>
      {/if}
      {#if profile.platformAliases && Object.keys(profile.platformAliases).length > 0}
        <div>
          <p class="text-sm text-slate-600 mb-2">Platform Aliases</p>
          <div class="space-y-1">
            {#if profile.platformAliases.steam}
              <p class="text-sm text-slate-700">
                <span class="font-medium">Steam:</span> {profile.platformAliases.steam}
              </p>
            {/if}
            {#if profile.platformAliases.android}
              <p class="text-sm text-slate-700">
                <span class="font-medium">Android:</span> {profile.platformAliases.android}
              </p>
            {/if}
            {#if profile.platformAliases.iphone}
              <p class="text-sm text-slate-700">
                <span class="font-medium">iPhone:</span> {profile.platformAliases.iphone}
              </p>
            {/if}
          </div>
        </div>
      {/if}
    </div>
  </Card>
{/if}
```

### 3. Auth Store Updates

**File:** `src/lib/stores/auth.ts`

**Updated User Interface:**
```typescript
export interface User {
  id: number;
  username: string;
  email: string;
  createdAt?: string;
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
}
```

### 4. Navigation Updates

**File:** `src/routes/(protected)/+layout.svelte`

**Updated Admin Link Check:**
```svelte
{#if $user.isSuperAdmin}
  <li>
    <a 
      href="/admin" 
      class="block px-4 py-2 text-slate-700 hover:bg-slate-50 rounded-md transition-colors {$page.url.pathname === '/admin' ? 'bg-slate-100 font-medium' : ''}"
    >
      Admin
    </a>
  </li>
{/if}
```

### 5. Admin Page Updates

**File:** `src/routes/(protected)/admin/+page.svelte`

**Updated Admin Check:**
```typescript
// Change from isAdmin to isSuperAdmin
$: if ($user !== null && $user !== undefined && userDataRefreshed && !dataLoaded) {
  const isSuperAdmin = $user.isSuperAdmin === true || ($user.isSuperAdmin as any) === 1;
  if (!isSuperAdmin) {
    console.log('User is not super admin, redirecting...');
    goto('/leagues');
  } else if (isSuperAdmin && loading) {
    loadData();
  }
}

onMount(async () => {
  // ... existing code ...
  
  // Check super admin status
  if ($user.isSuperAdmin !== true && ($user.isSuperAdmin as any) !== 1) {
    console.log('User is not super admin, redirecting...');
    goto('/leagues');
    return;
  }
  
  // ... rest of code ...
});
```

## API Endpoint Updates

### GET /api/profile

**Updated Implementation:**
```typescript
const user = db
  .prepare(`
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
    WHERE id = ?
  `)
  .get(userId) as UserRow | undefined;

return json({
  profile: {
    id: user.id,
    username: user.username,
    email: user.email,
    displayName: user.display_name || null,
    nickname: user.nickname || null,
    platforms: JSON.parse(user.platforms || '[]'),
    platformAliases: {
      steam: user.steam_alias || null,
      android: user.android_alias || null,
      iphone: user.iphone_alias || null
    },
    createdAt: user.created_at
  }
});
```

### PUT /api/profile

**Updated Implementation:**
```typescript
const { displayName, username, nickname, platforms, platformAliases } = await request.json();

// Validation for nickname
if (nickname !== undefined && nickname !== null && nickname.length > 50) {
  return json({ error: 'Nickname must be 50 characters or less' }, { status: 400 });
}

// Validation for platform aliases
if (platformAliases) {
  const validAliases = ['steam', 'android', 'iphone'];
  for (const [platform, alias] of Object.entries(platformAliases)) {
    if (!validAliases.includes(platform)) {
      return json({ error: `Invalid platform: ${platform}` }, { status: 400 });
    }
    if (alias !== null && alias !== undefined && alias.length > 100) {
      return json({ error: `${platform} alias must be 100 characters or less` }, { status: 400 });
    }
  }
}

// Update fields
if (nickname !== undefined) {
  updateFields.push('nickname = ?');
  updateValues.push(nickname || null);
}

if (platformAliases !== undefined) {
  updateFields.push('steam_alias = ?');
  updateValues.push(platformAliases.steam || null);
  
  updateFields.push('android_alias = ?');
  updateValues.push(platformAliases.android || null);
  
  updateFields.push('iphone_alias = ?');
  updateValues.push(platformAliases.iphone || null);
}
```

### GET /api/auth/me

**Updated Implementation:**
```typescript
const user = db
  .prepare('SELECT id, username, email, created_at as createdAt, is_admin, is_super_admin FROM users WHERE id = ?')
  .get(decoded.userId) as {
    id: number;
    username: string;
    email: string;
    createdAt: string;
    is_admin: number | null;
    is_super_admin: number | null;
  } | undefined;

return json({
  user: {
    id: user.id,
    username: user.username,
    email: user.email,
    createdAt: user.createdAt,
    isAdmin: user.is_admin === 1,
    isSuperAdmin: user.is_super_admin === 1
  }
});
```

## Database Row Types

```typescript
interface UserRow {
  id: number;
  username: string;
  email: string;
  display_name: string | null;
  nickname: string | null;
  platforms: string;
  steam_alias: string | null;
  android_alias: string | null;
  iphone_alias: string | null;
  created_at: string;
}
```

## Migration Script Details

**File:** `scripts/migrate-user-profiles.ts`

The migration script will:
1. Add all new columns to users table
2. Set sevenzig's nickname to "hotnut"
3. Set sevenzig as super admin
4. Transfer all hotnut data to sevenzig (if hotnut exists)
5. Delete hotnut account

**Key Migration Logic:**
- Use transactions for data integrity
- Check for existing data before transferring
- Handle duplicate league memberships gracefully
- Log all operations for debugging

---

This specification provides detailed implementation guidance for all component and API updates needed for the user profile enhancements and super admin system.
