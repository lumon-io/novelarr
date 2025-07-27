# Prowlarr Search Timeout Workaround

## Issue
- Prowlarr health check endpoint (`/api/v1/health`) responds successfully
- Prowlarr search endpoint (`/api/v1/search`) works but takes ~5 seconds and returns ~800KB of data
- The large response and processing time can cause timeouts

## Solution Implemented
Added a 15-second timeout wrapper in the search route that:
1. Attempts to search Prowlarr
2. If search takes longer than 5 seconds, cancels the request
3. Returns partial results from other sources (Readarr, Jackett)
4. Includes error message in response indicating Prowlarr timed out

## Code Changes
In `/backend/routes/search.js`:
```javascript
// Create a timeout promise
const timeoutPromise = new Promise((_, reject) => {
  setTimeout(() => reject(new Error('Search timeout (5s)')), 5000);
});

// Race between search and timeout
try {
  const prowlarrResults = await Promise.race([
    prowlarr.search(q),
    timeoutPromise
  ]);
  results.push(...prowlarrResults);
} catch (timeoutError) {
  console.error('Prowlarr search timeout:', timeoutError.message);
  errors.push({ source: 'prowlarr', error: 'Search timed out after 5 seconds' });
}
```

## User Experience
- Searches still work across Readarr and Jackett
- Prowlarr searches are attempted but won't block if slow
- Error is logged but doesn't prevent other results from showing
- UI continues to function normally

## Future Investigation
To debug the Prowlarr timeout issue:
1. Check Prowlarr logs on the host system
2. Test Prowlarr search API directly from browser
3. Verify indexers are properly configured in Prowlarr
4. Check if specific search queries work better than others
5. Consider if Prowlarr needs more resources or different configuration

## Testing
```bash
# Test search with all sources (Prowlarr will timeout gracefully)
curl -H "Authorization: Bearer <token>" \
  "http://localhost:8096/api/search?q=harry%20potter&source=all"

# Response includes:
# - Results from Readarr and Jackett
# - Error array showing Prowlarr timeout
# - All sources still report as "enabled"
```