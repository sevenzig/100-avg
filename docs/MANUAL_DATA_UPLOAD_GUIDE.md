# Manual Data Upload Process Guide

## Overview

The Wingspan Score Tracker supports uploading game data through screenshot images. The system uses AI-powered image recognition to automatically extract player names, scores, and scoring breakdowns from end-of-game screenshots. This guide explains the complete upload process, including how player name aliases are handled to ensure consistent data entry.

## Table of Contents

1. [Upload Process Flow](#upload-process-flow)
2. [Player Name Alias Matching](#player-name-alias-matching)
3. [Image Requirements](#image-requirements)
4. [Data Validation](#data-validation)
5. [Step-by-Step Instructions](#step-by-step-instructions)
6. [Troubleshooting](#troubleshooting)
7. [Best Practices](#best-practices)

---

## Upload Process Flow

The upload process follows these stages:

```
┌─────────────────────────────────────────────────────────────┐
│ 1. User Selects Image                                       │
│    - Drag & drop or file browser                            │
│    - Image preview displayed                                │
│    - Date selection                                          │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Image Upload & Validation                                │
│    - File type validation (PNG/JPEG)                        │
│    - File size check (max 10MB)                             │
│    - Magic number verification                               │
│    - League membership verification                          │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. AI Image Processing                                      │
│    - Image sent to Claude Vision API                        │
│    - Player names extracted                                 │
│    - Score breakdowns extracted                              │
│    - Placements calculated                                  │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Player Name Matching                                     │
│    - Match against usernames                                │
│    - Match against platform aliases                         │
│      • Steam alias                                          │
│      • Android alias                                        │
│      • iPhone alias                                         │
│    - Case-insensitive matching                               │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Data Review & Editing                                    │
│    - Extracted data displayed                               │
│    - Confidence score shown                                 │
│    - Warnings displayed (if any)                            │
│    - User can edit player names and scores                  │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. Validation & Save                                        │
│    - Score breakdown validation                             │
│    - Placement validation                                   │
│    - Final player matching                                  │
│    - Game saved to database                                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Player Name Alias Matching

### How It Works

The system automatically matches player names from screenshots to user accounts by checking multiple sources:

1. **Username Match**: Direct match against registered usernames
2. **Platform Alias Match**: Match against platform-specific aliases:
   - **Steam Alias**: Name used on Steam platform
   - **Android Alias**: Name used on Android app
   - **iPhone Alias**: Name used on iOS app

### Matching Logic

The matching process is **case-insensitive** and trims whitespace. The system checks in this order:

```sql
WHERE LOWER(TRIM(username)) = LOWER(TRIM(?))
   OR LOWER(TRIM(steam_alias)) = LOWER(TRIM(?))
   OR LOWER(TRIM(android_alias)) = LOWER(TRIM(?))
   OR LOWER(TRIM(iphone_alias)) = LOWER(TRIM(?))
```

### Example: Sevenzig and Hotnut

**Scenario**: A player named "sevenzig" uses "hotnut" as their Steam alias.

**Database Configuration**:
- Username: `sevenzig`
- Steam Alias: `hotnut`

**When uploading a screenshot**:
- If the screenshot shows "hotnut", the system will:
  1. Check for username "hotnut" → Not found
  2. Check for Steam alias "hotnut" → **Found!**
  3. Match to user "sevenzig" (ID: 1)
  4. Display: "hotnut (matched via alias)" in the review screen

**Result**: The game is correctly attributed to the "sevenzig" account, ensuring all games are tracked under the same user regardless of which platform name appears in the screenshot.

### Benefits

- **Consistent Data**: All games for the same player are tracked under one account
- **Platform Flexibility**: Players can use different names on different platforms
- **Automatic Matching**: No manual intervention needed for known aliases
- **Reduced Errors**: Prevents duplicate accounts for the same player

---

## Image Requirements

### Supported Formats

- **PNG** (`.png`)
- **JPEG** (`.jpg`, `.jpeg`)

### File Specifications

- **Maximum Size**: 10 MB
- **Minimum Dimensions**: 800x600 pixels (recommended)
- **Format Validation**: System verifies file headers (magic numbers) to prevent spoofing

### Image Quality Guidelines

For best extraction results:

✅ **Good Screenshots**:
- Clear, high-resolution images
- Good lighting and contrast
- All player names and scores clearly visible
- Complete score breakdown visible
- No obstructions or overlays

❌ **Poor Screenshots**:
- Blurry or low-resolution images
- Poor lighting or shadows
- Cropped or incomplete scoreboards
- Text obscured by UI elements
- Multiple screenshots stitched together

### Example Screenshot

When uploading, ensure your screenshot shows:
- All player names clearly visible
- Total scores for each player
- Complete scoring breakdown:
  - Birds
  - Bonus Cards
  - End of Round Goals
  - Eggs
  - Food on Cards
  - Tucked Cards
  - Nectar

### Example: Real Game Data

Here's an example of what the system extracts from a typical Wingspan score screenshot:

**Screenshot Shows:**
- **Player 1**: Blabberman23 - Total Score: 132
- **Player 2**: hotnut - Total Score: 116

**Extracted Data Structure:**
```json
{
  "players": [
    {
      "playerName": "Blabberman23",
      "placement": 1,
      "totalScore": 132,
      "scoringBreakdown": {
        "birds": 53,
        "bonusCards": 27,
        "endOfRoundGoals": 16,
        "eggs": 13,
        "foodOnCards": 0,
        "tuckedCards": 17,
        "nectar": 6
      }
    },
    {
      "playerName": "hotnut",
      "placement": 2,
      "totalScore": 116,
      "scoringBreakdown": {
        "birds": 53,
        "bonusCards": 12,
        "endOfRoundGoals": 10,
        "eggs": 3,
        "foodOnCards": 5,
        "tuckedCards": 18,
        "nectar": 15
      }
    }
  ]
}
```

**What Happens Next:**
1. System matches "Blabberman23" to username (if exists) or platform aliases
2. System matches "hotnut" to username or platform aliases (e.g., if "sevenzig" has "hotnut" as Steam alias)
3. Confidence score calculated: ~0.9 (high confidence - all data complete and valid)
4. User reviews and confirms the extracted data
5. Game is saved with proper user associations

---

## Data Validation

### Automatic Validation

The system performs several validation checks:

#### 1. Score Breakdown Validation

The sum of all scoring categories must equal the total score:

```
Total Score = Birds + Bonus Cards + End of Round Goals + Eggs + 
              Food on Cards + Tucked Cards + Nectar
```

**Tolerance**: ±1 point (to account for rounding)

#### 2. Placement Validation

- Placements must be unique
- Placements must be sequential (1, 2, 3, ...)
- Number of placements must match number of players

#### 3. Player Name Validation

- All players must have non-empty names
- Player names are sanitized (HTML/script tags removed)
- Maximum length: 50 characters

#### 4. Confidence Scoring

The system calculates a confidence score (0.0 - 1.0) based on:

- **Base Confidence**: 0.5
- **All players have names**: +0.2
- **All scores are reasonable** (0-200, integers): +0.2
- **Score breakdowns match totals**: +0.1

**Confidence Levels**:
- **High** (≥0.8): Green indicator, likely accurate
- **Medium** (0.6-0.8): Yellow indicator, review recommended
- **Low** (<0.6): Red indicator, manual review required

### Warnings

The system may display warnings for:

- Missing player names
- Score breakdown mismatches
- Unusual scores (outside 0-200 range)
- No players detected in screenshot

---

## Step-by-Step Instructions

### 1. Navigate to League Page

1. Log in to your account
2. Navigate to the desired league page (`/leagues/[id]`)
3. Ensure you are a member of the league (or have admin privileges)

### 2. Open Upload Modal

1. Click the **"Upload End of Game Screenshot"** button
2. The upload modal will open

### 3. Select Date

1. Use the date picker to select when the game was played
2. Defaults to today's date

### 4. Upload Image

**Option A: Drag and Drop**
1. Drag your screenshot file into the upload area
2. Release to drop the file
3. Image preview will appear

**Option B: File Browser**
1. Click **"Select a file"** button
2. Browse and select your screenshot
3. Image preview will appear

**Option C: Paste from Clipboard**
1. Copy your screenshot to clipboard (Ctrl+C / Cmd+C)
2. With the modal open, press Ctrl+V / Cmd+V
3. Image will be automatically uploaded

### 5. Process Image

1. Click **"Process Screenshot"** button
2. Wait for processing (typically 5-30 seconds)
3. A loading indicator will show progress

### 6. Review Extracted Data

The system will display:

- **Confidence Score**: Indicates extraction quality
- **Warnings** (if any): Issues to review
- **Player List**: 
  - Player names (editable)
  - Total scores
  - Score breakdowns (editable)
  - Placements (auto-calculated)

### 7. Edit Data (if needed)

You can edit:

- **Player Names**: Click on the name field to edit
  - System will attempt to match to existing users
  - Shows "(matched via alias)" if matched through alias
  - Shows "(new user)" if no match found
- **Score Breakdowns**: Adjust individual category scores
  - Total score recalculates automatically
  - Placements update automatically

### 8. Save Game

1. Review all data for accuracy
2. Ensure confidence is acceptable (or manually verify)
3. Click **"Save Game"** button
4. System validates data before saving
5. On success, modal closes and league page refreshes

---

## Troubleshooting

### Common Issues

#### "User not found" Error

**Problem**: Player name from screenshot doesn't match any user.

**Solutions**:
1. Check if the player has a platform alias set up
2. Edit the player name to match their username
3. Create a new user account if needed (system will prompt)

#### Low Confidence Score

**Problem**: System confidence is below 0.6.

**Solutions**:
1. Review extracted data carefully
2. Verify score breakdowns match totals
3. Check that all player names are correct
4. Manually adjust any incorrect values

#### Score Breakdown Mismatch

**Problem**: Sum of categories doesn't equal total score.

**Solutions**:
1. Review the original screenshot
2. Manually adjust category scores
3. Total score will recalculate automatically

#### Timeout Error

**Problem**: Request times out during processing.

**Solutions**:
1. Check image file size (should be < 10MB)
2. Try compressing the image
3. Ensure stable internet connection
4. Contact administrator if issue persists

#### "Not a member of this league" Error

**Problem**: You don't have permission to add games to this league.

**Solutions**:
1. Verify you're logged into the correct account
2. Ensure you're a member of the league
3. Contact league administrator to add you
4. If you're an admin, this shouldn't occur

### Getting Help

If you encounter issues not covered here:

1. Check the browser console for detailed error messages
2. Review the warnings displayed in the modal
3. Verify your image meets the requirements
4. Contact support with:
   - Screenshot of the error
   - Image file you're trying to upload
   - Browser and OS information

---

## Best Practices

### Before Uploading

1. **Verify Image Quality**
   - Ensure screenshot is clear and complete
   - Check that all scores are visible
   - Verify player names are readable

2. **Set Up Platform Aliases**
   - Add your platform-specific names to your profile
   - This ensures automatic matching across platforms
   - Reduces manual editing needed

3. **Check League Membership**
   - Verify you're a member of the target league
   - Ensure you have permission to add games

### During Upload

1. **Review Extracted Data**
   - Don't skip the review step
   - Verify player names are matched correctly
   - Check that scores match the screenshot

2. **Pay Attention to Warnings**
   - Review all warnings before saving
   - Fix any score breakdown mismatches
   - Verify unusual scores are correct

3. **Edit When Necessary**
   - Don't hesitate to correct extracted data
   - Player names can be edited if matching fails
   - Score breakdowns can be adjusted

### After Upload

1. **Verify Game Appears**
   - Check the league page to confirm game was saved
   - Verify all players are listed correctly
   - Confirm scores match the screenshot

2. **Report Issues**
   - If data is incorrect, note the game ID
   - Contact support with details
   - Include the original screenshot if possible

### Platform Alias Management

To ensure consistent matching:

1. **Add All Your Names**
   - Go to your profile page
   - Add Steam alias if you play on Steam
   - Add Android alias if you play on Android
   - Add iPhone alias if you play on iOS

2. **Use Consistent Names**
   - Use the same name format across platforms when possible
   - Update aliases if you change your in-game name

3. **Coordinate with League Members**
   - Ensure everyone has their aliases set up
   - Reduces manual editing during uploads

---

## Technical Details

### API Endpoints

#### POST `/api/games/upload-screenshot`

Uploads and processes a screenshot image.

**Request**:
- Method: `POST`
- Content-Type: `multipart/form-data`
- Body:
  - `image`: File (PNG/JPEG)
  - `leagueId`: Number

**Response**:
```json
{
  "success": true,
  "extractedData": {
    "players": [
      {
        "playerName": "string",
        "placement": number,
        "totalScore": number,
        "scoringBreakdown": {
          "birds": number,
          "bonusCards": number,
          "endOfRoundGoals": number,
          "eggs": number,
          "foodOnCards": number,
          "tuckedCards": number,
          "nectar": number
        }
      }
    ]
  },
  "confidence": number,
  "warnings": ["string"]
}
```

#### POST `/api/games`

Saves the reviewed game data to the database.

**Request**:
```json
{
  "leagueId": number,
  "playedAt": "ISO 8601 date string",
  "scores": [
    {
      "userId": number | null,
      "username": "string",
      "isNew": boolean,
      "placement": number,
      "totalScore": number,
      "birds": number,
      "bonusCards": number,
      "endOfRoundGoals": number,
      "eggs": number,
      "foodOnCards": number,
      "tuckedCards": number,
      "nectar": number
    }
  ]
}
```

### Rate Limiting

- Uploads are rate-limited per user
- Prevents abuse and ensures fair resource usage
- Contact administrator if you hit rate limits

### Security

- File type validation (magic number verification)
- File size limits
- Authentication required
- League membership verification
- Input sanitization

---

## Summary

The manual data upload process provides a streamlined way to add game data through screenshot images. The system's intelligent player name matching ensures consistent data entry across different platforms, while comprehensive validation helps maintain data quality.

**Key Takeaways**:

1. ✅ Set up platform aliases in your profile for automatic matching
2. ✅ Use high-quality screenshots for best extraction results
3. ✅ Always review extracted data before saving
4. ✅ Edit player names and scores when needed
5. ✅ Pay attention to warnings and confidence scores

For additional support or questions, please contact your league administrator or system support.

---

*Last Updated: January 2026*
