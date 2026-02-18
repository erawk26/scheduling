#!/bin/bash
set -e

echo "🚀 Starting KE Agenda V3 Development Environment"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Start PostgreSQL + Hasura with docker-compose
echo "📦 Starting database services..."
cd hasura
docker-compose up -d
cd ..

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
until docker exec ke-agenda-postgres pg_isready -U keagenda > /dev/null 2>&1; do
    sleep 1
done

echo "✅ Database services ready"
echo ""

# Check if migrations need to run
if docker exec ke-agenda-postgres psql -U keagenda -d keagenda -c "SELECT 1 FROM users LIMIT 1" > /dev/null 2>&1; then
    echo "✅ Database already migrated"
else
    echo "📝 Running database migrations..."
    docker exec -i ke-agenda-postgres psql -U keagenda -d keagenda < sql/complete_schema.sql
    echo "✅ Migrations complete"
fi

echo ""
echo "🎉 Everything ready! Starting Next.js dev server..."
echo ""

# Start Next.js dev server
npm run dev
