# Screenshot Upload & Game Data Extraction - System Design

## Overview
This document outlines the design for a feature that allows users to upload screenshots of post-game report cards, automatically extract game data using image parsing/OCR, and save the parsed data to the selected league's dataset.

## User Flow

```
1. User logs in
2. Navigates to league page (/leagues/[id])
3. Clicks "Upload End of Game Screenshot" button
4. Selects/upload image file
5. System processes image and extracts game data
6. User reviews/confirms extracted data
7. System saves game to selected league
```

## Architecture Components

### 1. Frontend Components

#### 1.1 UploadScreenshotModal Component
**Location:** `src/lib/components/scoreboard/UploadScreenshotModal.svelte`

**Props:**
- `open: boolean` - Modal visibility
- `leagueId: number` - Target league ID
- `leaguePlayers: Player[]` - Existing league players for validation

**Features:**
- File input with drag-and-drop support
- Image preview before upload
- Loading state during processing
- Extracted data review/edit interface
- Error display for parsing failures
- Validation before submission

**UI Structure:**
```
┌─────────────────────────────────────┐
│ Upload End of Game Screenshot      │
├─────────────────────────────────────┤
│ [Drag & Drop Area]                 │
│ or [Browse Files] button            │
│                                     │
│ [Image Preview]                     │
│                                     │
│ [Processing...] (when uploading)   │
│                                     │
│ [Extracted Data Review]            │
│ - Player names                      │
│ - Scores breakdown                  │
│ - Edit capability                   │
│                                     │
│ [Error Messages]                    │
├─────────────────────────────────────┤
│ [Cancel] [Confirm & Save]          │
└─────────────────────────────────────┘
```

#### 1.2 League Page Integration
**Location:** `src/routes/(protected)/leagues/[id]/+page.svelte`

**Changes:**
- Add "Upload Screenshot" button next to "Add Game" button
- Import and render `UploadScreenshotModal`
- Handle modal open/close state
- Handle successful upload (refresh league data)

### 2. Backend API Endpoints

#### 2.1 POST /api/games/upload-screenshot
**Purpose:** Upload screenshot and extract game data

**Request:**
- Method: POST
- Content-Type: multipart/form-data
- Body:
  ```typescript
  {
    leagueId: number;
    image: File; // Image file (PNG, JPG, JPEG)
  }
  ```

**Response (Success):**
```typescript
{
  success: true;
  extractedData: {
    players: Array<{
      playerName: string;
      placement: number;
      totalScore: number;
      scoringBreakdown: {
        birds: number;
        bonusCards: number;
        endOfRoundGoals: number;
        eggs: number;
        foodOnCards: number;
        tuckedCards: number;
        nectar: number;
      };
    }>;
  };
  confidence: number; // 0-1, parsing confidence score
  warnings?: string[]; // Any warnings about extraction
}
```

**Response (Error):**
```typescript
{
  success: false;
  error: string;
  // Note: Aligned with existing API error format - no 'code' field for consistency
}
```

**Validation:**
- File size limit: 10MB
- Allowed formats: PNG, JPG, JPEG
- MIME type validation (image/png, image/jpeg, image/jpg)
- Magic number validation (file header verification)
- File extension whitelist enforcement
- League membership check
- Image dimension validation (min 800x600)
- Input sanitization for extracted player names
- Score value range validation (0-999 per category)

#### 2.2 POST /api/games (Existing - Enhanced)
**Purpose:** Save extracted game data (reuse existing endpoint)

**Enhancement:** Add optional `source: 'screenshot'` metadata field

### 3. Image Processing Service

#### 3.1 Image Parser Service
**Location:** `src/lib/utils/image-parser.ts`

**Note:** Using `utils` directory to match existing codebase structure (no `services` directory exists)

**Responsibilities:**
- Image preprocessing (resize, enhance contrast)
- OCR/text extraction using Tesseract.js or cloud vision API
- Pattern recognition for score breakdown
- Data structure extraction

**Implementation Options:**

**Option A: Client-Side (Tesseract.js)**
- Pros: No server processing, privacy-friendly
- Cons: Large bundle size, slower processing, less accurate
- Library: `tesseract.js`

**Option B: Server-Side (Cloud Vision API)**
- Pros: High accuracy, fast processing, no client bundle impact
- Cons: Requires API key, costs per request
- Services: Google Cloud Vision, AWS Textract, Azure Computer Vision

**Option C: Hybrid (AI Vision Model)**
- Pros: Can be fine-tuned for Wingspan screenshots, high accuracy
- Cons: Requires model training, infrastructure
- Services: OpenAI Vision API, Anthropic Claude Vision

**Recommended: Option C (Anthropic Claude Vision)**
- High accuracy for structured data extraction
- Can be prompted specifically for Wingspan score format
- Reasonable pricing for this use case
- **Model:** Use `"claude-3-5-sonnet-20241022"` or `"claude-3-opus-20240229"` (current vision-capable models)

**Parser Logic:**
```typescript
interface ImageParser {
  parseScreenshot(imageBuffer: Buffer): Promise<ExtractedGameData>;
  validateExtraction(data: ExtractedGameData): ValidationResult;
  calculateConfidence(data: ExtractedGameData): number;
}
```

**Extraction Pattern:**
1. Send image to vision API with structured prompt
2. Extract player names and scores
3. Parse score breakdown categories
4. Calculate placements from total scores
5. Validate data consistency
6. Return structured data

### 4. Data Flow

```
┌─────────────┐
│   User      │
│  Uploads    │
│  Screenshot │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│  Frontend       │
│  - File Input   │
│  - Preview      │
│  - Validation   │
└──────┬──────────┘
       │ POST /api/games/upload-screenshot
       │ (multipart/form-data)
       ▼
┌─────────────────┐
│  API Endpoint   │
│  - Auth Check   │
│  - File Save    │
│  - Call Parser  │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│ Image Parser    │
│ Service         │
│ - Claude API    │
│ - Extract Data  │
│ - Validate      │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│  Return Data    │
│  to Frontend    │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│  User Reviews   │
│  & Confirms     │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│  POST /api/games│
│  (Save to DB)   │
└─────────────────┘
```

### 5. Database Schema

**No schema changes required** - Uses existing `games` and `scores` tables.

**Optional Enhancement:** Add metadata field to track source
```sql
ALTER TABLE games ADD COLUMN source TEXT DEFAULT 'manual';
-- Values: 'manual', 'screenshot'
```

### 6. Error Handling

#### 6.1 Parsing Errors
- **No players detected:** Show error, allow manual entry fallback
- **Low confidence:** Show warning, allow user to edit before saving
- **Invalid format:** Clear error message with format requirements
- **Partial extraction:** Show what was found, allow manual completion
- **API timeout:** Retry once, then show error with manual entry option
- **API rate limit:** Show user-friendly message with retry suggestion

#### 6.2 Validation Errors
- **Player not in league:** Offer to add player or select existing
- **Score mismatch:** Highlight discrepancy, allow correction
- **Missing data:** Show which fields need manual input
- **File validation errors:** Clear messages for size, type, format issues
- **Rate limit exceeded:** Show remaining time until reset

#### 6.3 Error Response Format
**Consistent with existing API:**
```typescript
{
  success: false,
  error: string // Human-readable error message
}
```
**Note:** No `code` field to maintain consistency with existing `/api/games` endpoint.

### 7. Security Considerations

1. **File Upload Security:**
   - Validate file type (MIME type + extension)
   - **Magic number validation** (verify file headers, not just MIME type)
   - **File extension whitelist** enforcement
   - Limit file size (10MB)
   - Store in secure temporary location
   - **Clean up temp files immediately after processing** (no scheduled cleanup needed)
   - **Input sanitization** for extracted player names (prevent XSS)
   - **Score value validation** (range checks: 0-999 per category)

2. **Authentication:**
   - Require user authentication
   - Verify league membership
   - **Rate limiting:** In-memory implementation (simple Map-based, 10 uploads/hour per user)
   - **Future:** Migrate to Redis for distributed rate limiting at scale
   - **API key management:** Monitor usage, set cost budgets, implement key rotation strategy
   - **Anthropic API:** Uses `ANTHROPIC_API_KEY` environment variable

3. **Data Privacy:**
   - Delete uploaded images **immediately after parsing** (no temp file storage needed)
   - Process image in memory, don't write to disk
   - Don't store images permanently
   - Log minimal metadata only (no image data in logs)
   - **Timeout handling:** 30-second timeout for parsing operations

### 8. Performance Optimization

1. **Image Optimization:**
   - Resize large images before processing
   - Compress before sending to API
   - Use WebP format if supported

2. **Caching:**
   - Cache parsed results temporarily (5 min) - optional optimization
   - Use image hash to avoid re-parsing identical images
   - **Note:** In-memory cache for single-instance deployments

3. **Async Processing:**
   - Process in background if > 5 seconds
   - Show progress indicator
   - WebSocket/SSE for status updates (optional)

### 9. User Experience Enhancements

1. **Drag & Drop:**
   - Visual feedback on drag over
   - Multiple file selection (process first valid)

2. **Preview:**
   - Show uploaded image
   - Highlight detected regions (optional)

3. **Edit Interface:**
   - Inline editing of extracted data
   - Auto-save draft (localStorage) - prevents data loss if modal closes
   - Session recovery for interrupted uploads

4. **Confidence Indicators:**
   - Visual confidence score
   - Highlight low-confidence fields
   - Suggest manual review

5. **Success Feedback:**
   - Show success message
   - Auto-close modal
   - Refresh league data
   - Show new game in recent games

### 10. Implementation Phases

#### Phase 1: Basic Upload & Parsing
- File upload component
- API endpoint for upload
- Basic image parser (Claude Vision)
- Data extraction and validation
- Save to database

#### Phase 2: Enhanced UX
- Drag & drop support
- Image preview
- Edit extracted data
- Confidence indicators
- Better error messages

#### Phase 3: Advanced Features
- Batch upload (multiple games)
- OCR fallback for edge cases
- Machine learning model fine-tuning
- Analytics on parsing accuracy

### 11. Technical Stack

**Frontend:**
- Svelte 5 components
- File API for uploads
- Fetch API for requests

**Backend:**
- SvelteKit API routes
- Anthropic Claude Vision API (or alternative)
- Sharp (image processing, optional)
- **SvelteKit native file handling** (uses `request.formData()`, not Multer/formidable)

**Dependencies to Add:**
```json
{
  "@anthropic-ai/sdk": "^0.27.0", // Anthropic Claude SDK
  "sharp": "^0.32.0" // optional, for image processing
}
```

### 12. API Integration Example

**SvelteKit File Upload Implementation:**
```typescript
// src/routes/api/games/upload-screenshot/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getUserId } from '$lib/utils/auth';

export const POST: RequestHandler = async ({ request, cookies }) => {
  const userId = getUserId(cookies);
  if (!userId) {
    return json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }

  try {
    // SvelteKit uses request.formData() for multipart/form-data
    const formData = await request.formData();
    const file = formData.get('image') as File;
    const leagueId = parseInt(formData.get('leagueId') as string);

    if (!file || !leagueId) {
      return json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    // Validate file
    const validationResult = validateImageFile(file);
    if (!validationResult.valid) {
      return json({ success: false, error: validationResult.error }, { status: 400 });
    }

    // Convert File to Buffer for processing
    const arrayBuffer = await file.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);

    // Parse screenshot (see image-parser.ts)
    const extractedData = await parseScreenshot(imageBuffer);

    // Return extracted data for user review
    return json({
      success: true,
      extractedData,
      confidence: calculateConfidence(extractedData),
      warnings: extractWarnings(extractedData)
    });
  } catch (error) {
    console.error('Upload screenshot error:', error);
    return json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
};
```

**Anthropic Claude Vision API Usage:**
```typescript
// src/lib/utils/image-parser.ts
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function parseScreenshot(imageBuffer: Buffer) {
  try {
    const base64Image = imageBuffer.toString('base64');
    const mimeType = imageBuffer[0] === 0x89 ? 'image/png' : 'image/jpeg';

    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022", // Current vision-capable model
      max_tokens: 1024,
      timeout: 30000, // 30 second timeout
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mimeType,
                data: base64Image
              }
            },
            {
              type: "text",
              text: `Extract game data from this Wingspan score screenshot. 
              Return JSON in this exact format:
              {
                "players": [
                  {
                    "playerName": "string",
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
              }`
            }
          ]
        }
      ]
    });
    
    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude API');
    }
    
    const textContent = content.text;
    if (!textContent) {
      throw new Error('No content returned from Claude API');
    }
    
    // Extract JSON from response (Claude may wrap it in markdown code blocks)
    const jsonMatch = textContent.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) || 
                      textContent.match(/(\{[\s\S]*\})/);
    
    if (!jsonMatch) {
      throw new Error('Could not extract JSON from Claude response');
    }
    
    return JSON.parse(jsonMatch[1]);
  } catch (error) {
    if (error instanceof Error) {
      // Handle API rate limits, timeouts, etc.
      if (error.message.includes('rate limit') || error.message.includes('429')) {
        throw new Error('API rate limit exceeded. Please try again later.');
      }
      if (error.message.includes('timeout')) {
        throw new Error('Request timed out. Please try again.');
      }
    }
    throw error;
  }
}
```

### 13. Testing Strategy

1. **Unit Tests:**
   - Image parser service
   - Data validation logic
   - Score calculation

2. **Integration Tests:**
   - API endpoint with mock images
   - File upload handling (SvelteKit formData)
   - Database save operations
   - **Mock Claude API** responses for consistent testing
   - Test fixtures for various image formats and edge cases

3. **E2E Tests:**
   - Complete upload flow
   - Error scenarios
   - User edit and save

4. **Test Data:**
   - Sample Wingspan screenshots
   - Edge cases (blurry, rotated, partial, corrupted)
   - Various player counts (2-5)
   - Invalid formats (wrong file types, oversized)
   - Network failure scenarios
   - API timeout scenarios

### 14. Monitoring & Analytics

1. **Metrics to Track:**
   - Upload success rate
   - Parsing accuracy
   - Average processing time
   - User edit frequency (indicates parsing issues)

2. **Logging:**
   - Upload attempts
   - Parsing errors
   - Confidence scores
   - User corrections

### 15. Future Enhancements

1. **Batch Processing:** Upload multiple screenshots at once
2. **Mobile App:** Native camera integration
3. **Auto-Detection:** Automatically detect league from screenshot
4. **Learning System:** Improve parsing based on user corrections
5. **Export:** Download extracted data as JSON/CSV

## File Structure

```
src/
├── lib/
│   ├── components/
│   │   └── scoreboard/
│   │       └── UploadScreenshotModal.svelte (NEW)
│   └── utils/
│       ├── image-parser.ts (NEW) - Image parsing service
│       └── file-validation.ts (NEW) - File validation utilities
├── routes/
│   └── api/
│       └── games/
│           └── upload-screenshot/
│               └── +server.ts (NEW)
└── types/
    └── screenshot-upload.ts (NEW) - Type definitions
```

**Note:** No `services` directory - using `utils` to match existing codebase structure. No `static/uploads` needed - processing in memory.

## Environment Variables

```env
# .env
ANTHROPIC_API_KEY=sk-ant-... # Anthropic Claude API key
MAX_UPLOAD_SIZE=10485760 # 10MB in bytes
# Note: No UPLOAD_TEMP_DIR needed - processing in memory
```

## Type Definitions

```typescript
// src/types/screenshot-upload.ts

export interface ExtractedPlayer {
  playerName: string;
  placement: number;
  totalScore: number;
  scoringBreakdown: {
    birds: number;
    bonusCards: number;
    endOfRoundGoals: number;
    eggs: number;
    foodOnCards: number;
    tuckedCards: number;
    nectar: number;
  };
}

export interface ExtractedGameData {
  players: ExtractedPlayer[];
}

export interface ParsingResult {
  success: boolean;
  extractedData?: ExtractedGameData;
  confidence?: number;
  warnings?: string[];
  error?: string;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}
```

## File Validation Implementation

```typescript
// src/lib/utils/file-validation.ts

const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/jpg'];
const ALLOWED_EXTENSIONS = ['.png', '.jpg', '.jpeg'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MIN_IMAGE_DIMENSIONS = { width: 800, height: 600 };

// Magic numbers for image file headers
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
const JPEG_MAGIC = Buffer.from([0xFF, 0xD8, 0xFF]);

export function validateImageFile(file: File): ValidationResult {
  // MIME type check
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return { valid: false, error: 'Invalid file type. Only PNG and JPEG images are allowed.' };
  }

  // File extension check
  const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return { valid: false, error: 'Invalid file extension.' };
  }

  // File size check
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit.` };
  }

  return { valid: true };
}

export async function validateImageHeader(file: File): Promise<ValidationResult> {
  // Read first bytes to verify magic numbers
  const arrayBuffer = await file.slice(0, 8).arrayBuffer();
  const header = Buffer.from(arrayBuffer);

  const isPNG = header.subarray(0, 8).equals(PNG_MAGIC);
  const isJPEG = header.subarray(0, 3).equals(JPEG_MAGIC);

  if (!isPNG && !isJPEG) {
    return { valid: false, error: 'File header does not match image format.' };
  }

  return { valid: true };
}

export function sanitizePlayerName(name: string): string {
  // Remove potentially dangerous characters, limit length
  return name
    .trim()
    .replace(/[<>\"']/g, '') // Remove HTML/script tags
    .substring(0, 50); // Limit length
}

export function validateScoreValue(value: number, category: string): boolean {
  // Validate score ranges (0-999 is reasonable for Wingspan)
  if (value < 0 || value > 999 || !Number.isInteger(value)) {
    return false;
  }
  return true;
}
```

## Rate Limiting Implementation

```typescript
// src/lib/utils/rate-limiter.ts

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<number, RateLimitEntry>();
const RATE_LIMIT = 10; // uploads per hour
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour in milliseconds

export function checkRateLimit(userId: number): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(userId);

  if (!entry || now > entry.resetTime) {
    // Reset or create new entry
    rateLimitStore.set(userId, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW
    });
    return { allowed: true, remaining: RATE_LIMIT - 1 };
  }

  if (entry.count >= RATE_LIMIT) {
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: RATE_LIMIT - entry.count };
}

// Cleanup old entries periodically (optional)
setInterval(() => {
  const now = Date.now();
  for (const [userId, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(userId);
    }
  }
}, 5 * 60 * 1000); // Every 5 minutes
```

## Summary

This design provides a complete solution for screenshot-based game data entry with:
- ✅ User-friendly upload interface
- ✅ Robust image parsing using AI vision
- ✅ Data validation and user review
- ✅ Secure file handling
- ✅ Error handling and fallbacks
- ✅ Scalable architecture

The implementation can be done incrementally, starting with basic functionality and adding enhancements based on user feedback.

## Implementation Notes

### Key Improvements from Analysis

1. **SvelteKit-Native Implementation:**
   - Uses `request.formData()` instead of Multer/formidable
   - Processes files in memory (no temp file storage needed)
   - Follows SvelteKit patterns and conventions

2. **Claude Vision API Integration:**
   - Using Anthropic Claude Vision API (`claude-3-5-sonnet-20241022`)
   - Added timeout handling and error recovery
   - JSON extraction from Claude's text responses (handles markdown code blocks)

3. **Enhanced Security:**
   - Magic number validation for file headers
   - Input sanitization for extracted data
   - Comprehensive file validation

4. **Consistent Error Handling:**
   - Aligned with existing API error format
   - No `code` field for consistency

5. **Rate Limiting:**
   - Simple in-memory implementation
   - Documented migration path to Redis

6. **Type Safety:**
   - Comprehensive TypeScript definitions
   - Validation utilities with proper types

7. **File Structure:**
   - Uses `utils` directory (matches existing codebase)
   - No unnecessary temp directories
   - Clear separation of concerns
