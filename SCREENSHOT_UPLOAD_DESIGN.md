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
  code?: 'PARSE_ERROR' | 'INVALID_FORMAT' | 'NO_PLAYERS_FOUND' | 'SERVER_ERROR';
}
```

**Validation:**
- File size limit: 10MB
- Allowed formats: PNG, JPG, JPEG
- League membership check
- Image dimension validation (min 800x600)

#### 2.2 POST /api/games (Existing - Enhanced)
**Purpose:** Save extracted game data (reuse existing endpoint)

**Enhancement:** Add optional `source: 'screenshot'` metadata field

### 3. Image Processing Service

#### 3.1 Image Parser Service
**Location:** `src/lib/services/image-parser.ts`

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

**Recommended: Option C (OpenAI Vision API)**
- High accuracy for structured data extraction
- Can be prompted specifically for Wingspan score format
- Reasonable pricing for this use case

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
│ - Vision API    │
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

#### 6.2 Validation Errors
- **Player not in league:** Offer to add player or select existing
- **Score mismatch:** Highlight discrepancy, allow correction
- **Missing data:** Show which fields need manual input

### 7. Security Considerations

1. **File Upload Security:**
   - Validate file type (MIME type + extension)
   - Limit file size (10MB)
   - Scan for malicious content
   - Store in secure temporary location
   - Clean up temp files after processing

2. **Authentication:**
   - Require user authentication
   - Verify league membership
   - Rate limiting (e.g., 10 uploads/hour per user)

3. **Data Privacy:**
   - Delete uploaded images after processing
   - Don't store images permanently
   - Log minimal metadata only

### 8. Performance Optimization

1. **Image Optimization:**
   - Resize large images before processing
   - Compress before sending to API
   - Use WebP format if supported

2. **Caching:**
   - Cache parsed results temporarily (5 min)
   - Avoid re-parsing same image

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
   - Auto-save draft (localStorage)

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
- Basic image parser (OpenAI Vision)
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
- OpenAI Vision API (or alternative)
- Sharp (image processing, optional)
- Multer/formidable (file handling)

**Dependencies to Add:**
```json
{
  "openai": "^4.0.0", // or alternative vision API client
  "sharp": "^0.32.0" // optional, for image processing
}
```

### 12. API Integration Example

**OpenAI Vision API Usage:**
```typescript
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function parseScreenshot(imageBuffer: Buffer) {
  const response = await openai.chat.completions.create({
    model: "gpt-4-vision-preview",
    messages: [
      {
        role: "user",
        content: [
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
          },
          {
            type: "image_url",
            image_url: {
              url: `data:image/png;base64,${imageBuffer.toString('base64')}`
            }
          }
        ]
      }
    ],
    max_tokens: 1000
  });
  
  return JSON.parse(response.choices[0].message.content);
}
```

### 13. Testing Strategy

1. **Unit Tests:**
   - Image parser service
   - Data validation logic
   - Score calculation

2. **Integration Tests:**
   - API endpoint with mock images
   - File upload handling
   - Database save operations

3. **E2E Tests:**
   - Complete upload flow
   - Error scenarios
   - User edit and save

4. **Test Data:**
   - Sample Wingspan screenshots
   - Edge cases (blurry, rotated, partial)
   - Various player counts (2-5)

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
│   ├── services/
│   │   └── image-parser.ts (NEW)
│   └── utils/
│       └── file-upload.ts (NEW, optional)
├── routes/
│   └── api/
│       └── games/
│           └── upload-screenshot/
│               └── +server.ts (NEW)
└── static/
    └── uploads/ (temporary, gitignored)
```

## Environment Variables

```env
# .env
OPENAI_API_KEY=sk-... # or alternative vision API key
MAX_UPLOAD_SIZE=10485760 # 10MB in bytes
UPLOAD_TEMP_DIR=./uploads/temp
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
