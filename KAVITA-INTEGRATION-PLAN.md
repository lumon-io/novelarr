# Kavita Request Integration Plan

## Current Date: July 27, 2025

## Integration Approaches

### Option 1: Companion App with Deep Integration
Build Novelarr as a companion that:
- Uses Kavita's API to check library status
- Shows "Request" button for missing books
- Integrates with Kavita's user system
- Appears seamless to end users

**Pros:**
- Can start immediately
- Full control over features
- Works with existing Kavita installs

**Cons:**
- Separate app to maintain
- Users need both apps

### Option 2: Reverse Proxy with UI Injection
Create a reverse proxy that:
- Sits in front of Kavita
- Injects request buttons into Kavita's UI
- Handles request logic transparently

**Pros:**
- Truly seamless experience
- No separate UI to learn

**Cons:**
- Complex to implement
- May break with Kavita updates

### Option 3: Contribute to Kavita Core
Add request functionality directly to Kavita:
- Fork Kavita and add features
- Submit PR to main project
- Become official feature

**Pros:**
- Best long-term solution
- Benefits entire community

**Cons:**
- Requires C#/.NET knowledge
- May not align with Kavita's vision

## Recommended Approach: Smart Companion App

Build Novelarr as a **"Request Hub for Kavita"** that:

### 1. Seamless Authentication
```javascript
// Use Kavita's API key system
const kavitaAuth = await axios.post(`${kavitaUrl}/api/Plugin/authenticate`, {
  apiKey: userApiKey
});
// Use returned JWT for all requests
```

### 2. Library Status Integration
```javascript
// Check if book exists in Kavita
const exists = await checkKavitaLibrary(bookTitle, author);
if (!exists) {
  // Show request option
}
```

### 3. Smart UI Integration
- Browser extension that adds "Request" buttons to Kavita
- Mobile app that works alongside Tachiyomi/Paperback
- Web UI that complements Kavita's interface

### 4. Request Workflow
```
User searches in Novelarr → Check Kavita library → 
If missing → Search sources → Request via Readarr → 
Monitor download → Notify when in Kavita
```

## Implementation Plan

### Phase 1: Core Integration (Week 1)
- [ ] Kavita API client
- [ ] Library sync/check
- [ ] User authentication passthrough

### Phase 2: Request System (Week 2)
- [ ] Readarr integration
- [ ] Request tracking
- [ ] Download monitoring

### Phase 3: Enhanced Features (Week 3)
- [ ] Send to Kindle
- [ ] Request approval workflow
- [ ] Notifications

### Phase 4: UI Polish (Week 4)
- [ ] Browser extension
- [ ] Mobile-friendly UI
- [ ] Kavita theme matching

## API Endpoints Needed

### From Kavita
- `/api/Library` - Check library contents
- `/api/Series/search` - Search existing books
- `/api/Plugin/authenticate` - Auth integration
- `/api/User` - User management

### From Novelarr
- `/api/request` - Submit book request
- `/api/request/status` - Check request status
- `/api/kindle/send` - Send to Kindle
- `/api/sources/search` - Search all sources

## User Experience

1. **In Kavita**: Reading existing books normally
2. **In Novelarr**: 
   - Search for new books
   - See "In Library" badge for existing books
   - Request missing books
   - Track request status
   - Send to Kindle

3. **Notifications**: When book arrives in Kavita

## Next Steps

Should we proceed with building this Kavita-focused companion app?