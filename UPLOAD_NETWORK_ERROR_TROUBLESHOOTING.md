# Upload NetworkError Troubleshooting Guide

## Issue
**Error:** `TypeError: NetworkError when attempting to fetch resource`

This error occurs when the browser cannot complete the fetch request to the upload endpoint.

## Root Causes & Solutions

### 1. ✅ **Improved Error Handling (FIXED)**

**Problem:** The original code didn't properly handle network errors, timeouts, or non-JSON responses.

**Solution Applied:**
- Added AbortController for timeout handling (60 seconds)
- Added proper error type detection (AbortError, TypeError, etc.)
- Added JSON parsing error handling
- Added response status checking before parsing
- Improved error messages for different failure scenarios

**Files Updated:**
- `src/lib/components/scoreboard/UploadScreenshotModal.svelte` - Enhanced `uploadAndParse()` function

### 2. **API Key Configuration**

**Check:** Verify the Anthropic API key is set correctly.

**Diagnosis:**
```bash
# Check if API key is in .env file
cat .env | grep ANTHROPIC_API_KEY
```

**Solution:**
- Ensure `ANTHROPIC_API_KEY` is set in `.env` file
- Restart the dev server after adding the key
- For production, add to environment variables

**Error Message:** "API key not configured. Please contact the administrator."

### 3. **Server Not Running**

**Check:** Verify the development server is running.

**Solution:**
```bash
npm run dev
```

**Verify:** Check browser console for connection errors.

### 4. **Request Timeout**

**Problem:** Large images or slow API responses can cause timeouts.

**Solution Applied:**
- Added 60-second timeout with AbortController
- Server-side timeout set to 30 seconds for Claude API

**If Still Timing Out:**
- Reduce image size before upload
- Check network connection
- Verify Claude API is responding

### 5. **File Size Too Large / Body Size Limit Exceeded**

**Error:** `Content-length of X exceeds limit of 524288 bytes` (413 Payload Too Large)

**Problem:** In production, `@sveltejs/adapter-node` has a default 512KB body size limit that must be configured via environment variable.

**Current Limits:**
- Client-side: 10MB check in component
- Development: 12MB body size limit (in `hooks.server.ts`)
- **Production: Must set `BODY_SIZE_LIMIT` environment variable**

**Solution Applied:**
- ✅ Added `BODY_SIZE_LIMIT=12582912` (12MB) to `docker-compose.prod.yml`
- ✅ Added `BODY_SIZE_LIMIT=12582912` to `.env.production`
- ✅ Added `BODY_SIZE_LIMIT=12582912` to `Dockerfile` ENV

**If Still Getting 413 Error:**
1. Verify `BODY_SIZE_LIMIT` is set in production environment
2. Restart the container after setting the variable
3. Check docker-compose logs: `docker-compose logs app | grep BODY_SIZE`
4. Compress image before upload if still too large

### 6. **CORS Issues (Unlikely for Same-Origin)**

**Check:** Only relevant if accessing from different domain.

**Solution:** Not applicable for same-origin requests (localhost to localhost).

### 7. **Server-Side Errors**

**Check:** Look at server console logs for errors.

**Common Issues:**
- Missing dependencies (`@anthropic-ai/sdk` not installed)
- Database connection errors
- Invalid API key format
- Rate limiting

**Solution:**
```bash
# Check if Anthropic SDK is installed
npm list @anthropic-ai/sdk

# Install if missing
npm install @anthropic-ai/sdk
```

### 8. **Network Connectivity**

**Check:** Verify internet connection for Claude API calls.

**Solution:**
- Check internet connection
- Verify firewall isn't blocking requests
- Test Claude API directly

## Debugging Steps

### Step 1: Check Browser Console
1. Open browser DevTools (F12)
2. Go to Network tab
3. Attempt upload
4. Check for failed requests
5. Look at request/response details

### Step 2: Check Server Logs
1. Look at terminal running `npm run dev`
2. Check for error messages
3. Look for stack traces

### Step 3: Test API Endpoint Directly
```bash
# Test with curl (replace with actual values)
curl -X POST http://localhost:5173/api/games/upload-screenshot \
  -F "image=@test-image.png" \
  -F "leagueId=1" \
  -H "Cookie: token=YOUR_TOKEN"
```

### Step 4: Verify Environment Variables
```bash
# Check .env file exists and has API key
cat .env

# Verify key format (should start with sk-ant-)
grep ANTHROPIC_API_KEY .env
```

## Error Messages Reference

| Error Message | Cause | Solution |
|--------------|-------|----------|
| "Network error. Please check your connection" | Fetch failed before response | Check server is running, verify network |
| "Content-length exceeds limit of 524288 bytes" | Body size limit exceeded (production) | Set `BODY_SIZE_LIMIT=12582912` in production env |
| "Request timed out" | Request took > 60 seconds | Reduce image size, check API response time |
| "API key not configured" | Missing ANTHROPIC_API_KEY | Add key to .env and restart server |
| "API rate limit exceeded" | Too many requests | Wait and retry later |
| "Invalid response from server" | Server returned non-JSON | Check server logs for errors |
| "Server error (500)" | Server-side exception | Check server logs, verify API key |
| "Payload Too Large (413)" | File exceeds body size limit | Set `BODY_SIZE_LIMIT` env var and restart |

## Prevention

1. **Always check server is running** before testing uploads
2. **Verify API key** is set in environment
3. **Test with small images first** (< 1MB)
4. **Monitor server logs** during upload attempts
5. **Check browser console** for detailed error information

## Testing Checklist

- [ ] Server is running (`npm run dev`)
- [ ] API key is set in `.env` file
- [ ] `@anthropic-ai/sdk` is installed
- [ ] Image file is valid (PNG/JPEG)
- [ ] Image size is under 10MB
- [ ] User is authenticated (logged in)
- [ ] User is member of the league
- [ ] Network connection is stable
- [ ] Browser console shows no CORS errors
- [ ] **Production: `BODY_SIZE_LIMIT` is set in environment (12MB = 12582912)**
- [ ] **Production: Container restarted after setting `BODY_SIZE_LIMIT`**

## Next Steps

If error persists after checking all above:

1. **Check server logs** for detailed error messages
2. **Test API endpoint** with curl/Postman
3. **Verify Anthropic API** is accessible
4. **Check rate limits** on Anthropic account
5. **Review browser Network tab** for request details

## Code Changes Summary

### Frontend (`UploadScreenshotModal.svelte`)
- ✅ Added AbortController for timeout handling
- ✅ Improved error type detection
- ✅ Added JSON parsing error handling
- ✅ Better error messages for different scenarios

### Backend (`image-parser.ts`)
- ✅ Added API key validation
- ✅ Improved error handling for API errors
- ✅ Better error messages for different failure types

These improvements should provide clearer error messages and better handling of network issues.
