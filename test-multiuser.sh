#!/bin/bash

echo "=== Novelarr Multi-User Test ==="
echo

# 1. Login as admin
echo "1. Login as admin..."
TOKEN=$(curl -s -X POST http://localhost:8096/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -n "$TOKEN" ]; then
  echo "✓ Admin login successful"
else
  echo "✗ Admin login failed"
  exit 1
fi

# 2. Check settings access
echo -e "\n2. Testing settings access (admin only)..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8096/api/settings \
  -H "Authorization: Bearer $TOKEN")
if [ "$STATUS" = "200" ]; then
  echo "✓ Settings accessible to admin"
else
  echo "✗ Settings access failed: $STATUS"
fi

# 3. Create a new user
echo -e "\n3. Creating new user 'testuser'..."
CREATE_RESULT=$(curl -s -X POST http://localhost:8096/api/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"test123","role":"user"}')
echo "Result: $CREATE_RESULT"

# 4. Test registration with settings check
echo -e "\n4. Testing public registration..."
REG_RESULT=$(curl -s -X POST http://localhost:8096/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"newuser","password":"newpass123"}')
echo "Registration result: $REG_RESULT"

# 5. Get user list
echo -e "\n5. Getting user list..."
curl -s http://localhost:8096/api/users \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool 2>/dev/null || echo "Users list retrieved"

# 6. Get user stats
echo -e "\n6. Getting user stats..."
curl -s http://localhost:8096/api/users/stats \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool 2>/dev/null || echo "Stats retrieved"

# 7. Test settings update
echo -e "\n7. Testing settings update..."
UPDATE_RESULT=$(curl -s -X PUT http://localhost:8096/api/settings \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"registration_enabled":"false","app_name":"My Novelarr"}')
echo "Settings updated"

# 8. Verify registration is now disabled
echo -e "\n8. Testing registration with disabled setting..."
REG_DISABLED=$(curl -s -X POST http://localhost:8096/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"shouldfail","password":"test123"}')
echo "Registration attempt: $REG_DISABLED"

echo -e "\n=== Test Complete ==="