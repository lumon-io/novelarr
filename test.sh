#!/bin/bash

echo "=== Novelarr Docker Test ==="
echo

echo "1. Testing health endpoint..."
curl -s http://localhost:8096/api/health | jq . || echo "Health check failed"
echo

echo "2. Testing login (default admin)..."
TOKEN=$(curl -s -X POST http://localhost:8096/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' | jq -r .token)

if [ "$TOKEN" != "null" ] && [ -n "$TOKEN" ]; then
  echo "✓ Login successful"
  echo "Token: ${TOKEN:0:20}..."
else
  echo "✗ Login failed"
  exit 1
fi
echo

echo "3. Testing book search..."
SEARCH=$(curl -s http://localhost:8096/api/search?q=harry \
  -H "Authorization: Bearer $TOKEN")

if echo "$SEARCH" | jq -e '.results' > /dev/null 2>&1; then
  echo "✓ Search working"
  echo "Results found: $(echo "$SEARCH" | jq '.results | length')"
else
  echo "✗ Search failed"
  echo "$SEARCH"
fi
echo

echo "4. Container status:"
docker ps --filter name=novelarr --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo

echo "5. Database check:"
docker exec novelarr ls -la /config/
echo

echo "=== Test Complete ==="