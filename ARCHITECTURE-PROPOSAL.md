# Novelarr Architecture Proposal

## New Vision: The Missing Link in the Book Ecosystem

Instead of recreating existing excellent tools, Novelarr should be the **request and discovery hub** that connects everything together.

## Core Purpose

Novelarr acts as the unified interface for:
1. **Book Discovery** - Search across multiple sources (Goodreads, Jackett, Prowlarr)
2. **Request Management** - Send requests to Readarr/LazyLibrarian
3. **Library Integration** - Connect to Kavita/Calibre-Web for reading
4. **User Features** - Send to Kindle, request approval, notifications

## Integration Points

### 1. Download Automation
- **Readarr** - Primary book downloader
- **LazyLibrarian** - Alternative book downloader
- **SABnzbd/NZBGet** - Usenet downloaders
- **qBittorrent/Transmission** - Torrent clients

### 2. Library Management
- **Kavita** - Modern reading server (recommended)
- **Calibre-Web** - Web interface for Calibre
- **Komga** - Alternative reader
- **Ubooquity** - Lightweight option

### 3. Book Sources
- **Goodreads** - Metadata and discovery
- **Jackett** - Torrent indexers
- **Prowlarr** - Unified indexer management

## Proposed Architecture

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────┐
│   Web UI        │     │  Readarr/    │     │   Kavita/   │
│  (Discovery)    │────▶│LazyLibrarian │────▶│Calibre-Web  │
└─────────────────┘     └──────────────┘     └─────────────┘
         │                      │                     │
         │                      ▼                     │
         │              ┌──────────────┐              │
         └─────────────▶│   Novelarr   │◀─────────────┘
                        │   Backend    │
                        └──────────────┘
                               │
                        ┌──────┴───────┐
                        │              │
                  ┌─────▼────┐  ┌─────▼────┐
                  │ Jackett/  │  │  Send to │
                  │ Prowlarr  │  │  Kindle  │
                  └───────────┘  └──────────┘
```

## Key Features to Implement

### 1. Unified Search Interface
- Search Goodreads, Jackett, Prowlarr simultaneously
- Show availability in Kavita/Calibre library
- One-click request to Readarr/LazyLibrarian

### 2. Request Management
- Track request status across systems
- Approval workflow for family/shared instances
- Notifications when books are available

### 3. Library Integration
- Check if book exists in Kavita/Calibre
- Direct links to read in Kavita
- Show reading progress from Kavita

### 4. Send to Kindle
- Convert and email books to Kindle addresses
- Track which books were sent to which devices
- Automatic format conversion

### 5. User Management
- Individual Kindle emails
- Request limits/quotas
- Reading history sync

## Benefits of This Approach

1. **No Duplication** - Use best-in-class tools for each function
2. **User Friendly** - Single interface for discovery and requests
3. **Family Friendly** - Request approval, user limits
4. **Ecosystem Fit** - Works with existing *arr setup

## Implementation Priority

1. ✅ Search integration (Readarr, Jackett, Prowlarr)
2. 🔄 Kavita API integration
3. ⏳ Request workflow with Readarr
4. ⏳ Send to Kindle functionality
5. ⏳ Calibre library support
6. ⏳ LazyLibrarian support

## Next Steps

Should we pivot to this architecture and integrate with Kavita as the reading server?