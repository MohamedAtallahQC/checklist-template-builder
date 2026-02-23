#!/bin/bash

# Test script for Checklist System Docker deployment
# This script tests the backend API and demo account login

set -e

echo "========================================="
echo "Checklist System - Docker Test Script"
echo "========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Check if all containers are running
echo "Test 1: Checking if all containers are running..."
if docker-compose ps | grep -q "checklist_backend.*healthy" && \
   docker-compose ps | grep -q "checklist_frontend.*healthy" && \
   docker-compose ps | grep -q "checklist_db.*healthy" && \
   docker-compose ps | grep -q "checklist_redis.*healthy"; then
    echo -e "${GREEN}✓ All containers are running and healthy${NC}"
else
    echo -e "${RED}✗ Some containers are not healthy${NC}"
    docker-compose ps
    exit 1
fi
echo ""

# Test 2: Check backend health endpoint
echo "Test 2: Testing backend health endpoint..."
HEALTH_RESPONSE=$(curl -s http://localhost:3005/api/v1/health)
if echo "$HEALTH_RESPONSE" | grep -q '"status":"ok"'; then
    echo -e "${GREEN}✓ Backend health check passed${NC}"
    echo "   Response: $HEALTH_RESPONSE"
else
    echo -e "${RED}✗ Backend health check failed${NC}"
    echo "   Response: $HEALTH_RESPONSE"
    exit 1
fi
echo ""

# Test 3: Test demo account login
echo "Test 3: Testing demo account login..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3005/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@checklist.local","password":"Admin@123456"}')

if echo "$LOGIN_RESPONSE" | grep -q '"accessToken"'; then
    echo -e "${GREEN}✓ Demo account login successful${NC}"
    echo "   Email: admin@checklist.local"
    echo "   User: $(echo "$LOGIN_RESPONSE" | jq -r '.user.firstName + " " + .user.lastName')"
    echo "   Roles: $(echo "$LOGIN_RESPONSE" | jq -r '.user.roles | join(", ")')"
else
    echo -e "${RED}✗ Demo account login failed${NC}"
    echo "   Response: $LOGIN_RESPONSE"
    exit 1
fi
echo ""

# Test 4: Check frontend accessibility
echo "Test 4: Testing frontend accessibility..."
FRONTEND_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3006)
if [ "$FRONTEND_RESPONSE" = "200" ]; then
    echo -e "${GREEN}✓ Frontend is accessible${NC}"
    echo "   URL: http://localhost:3006"
else
    echo -e "${RED}✗ Frontend is not accessible (HTTP $FRONTEND_RESPONSE)${NC}"
    exit 1
fi
echo ""

# Test 5: Test authenticated API request
echo "Test 5: Testing authenticated API request..."
ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.accessToken')
ME_RESPONSE=$(curl -s http://localhost:3005/api/v1/auth/me \
  -H "Authorization: Bearer $ACCESS_TOKEN")

if echo "$ME_RESPONSE" | grep -q '"email":"admin@checklist.local"'; then
    echo -e "${GREEN}✓ Authenticated API request successful${NC}"
    echo "   Endpoint: /api/v1/auth/me"
else
    echo -e "${RED}✗ Authenticated API request failed${NC}"
    echo "   Response: $ME_RESPONSE"
    exit 1
fi
echo ""

# Summary
echo "========================================="
echo -e "${GREEN}All tests passed successfully!${NC}"
echo "========================================="
echo ""
echo "Demo Account Credentials:"
echo "  Email:    admin@checklist.local"
echo "  Password: Admin@123456"
echo ""
echo "Access URLs:"
echo "  Frontend:  http://localhost:3006"
echo "  Backend:   http://localhost:3005/api/v1"
echo "  API Docs:  http://localhost:3005/api/v1/docs"
echo ""
echo -e "${YELLOW}⚠️  Remember to change the default password in production!${NC}"
echo ""
