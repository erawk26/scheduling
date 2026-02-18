#!/bin/bash

echo "🛑 Stopping KE Agenda V3 Development Environment"
echo ""

# Stop Next.js dev server (if running)
pkill -f "next dev" 2>/dev/null && echo "✅ Stopped Next.js dev server" || echo "ℹ️  Next.js dev server not running"

# Stop Docker services
echo "📦 Stopping database services..."
cd hasura
docker-compose down
cd ..

echo ""
echo "✅ All services stopped"
