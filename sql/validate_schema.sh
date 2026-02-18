#!/bin/bash
# Schema validation script for KE Agenda V3
# Checks SQL syntax and schema completeness

set -e

echo "🔍 Validating PostgreSQL Schema..."

# Check if PostgreSQL is available
if ! command -v psql &> /dev/null; then
    echo "❌ psql not found. Install PostgreSQL client to validate."
    exit 1
fi

# Create temporary database for validation
DB_NAME="ke_agenda_validate_$(date +%s)"
echo "📦 Creating temporary database: $DB_NAME"

createdb $DB_NAME 2>/dev/null || {
    echo "⚠️  Using existing database"
}

# Run schema
echo "🏗️  Applying schema..."
psql -d $DB_NAME -f complete_schema.sql -v ON_ERROR_STOP=1 > /dev/null

# Validate table counts
echo "📊 Validating tables..."
TABLE_COUNT=$(psql -d $DB_NAME -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';")

if [ "$TABLE_COUNT" -eq 10 ]; then
    echo "✅ All 10 tables created successfully"
else
    echo "❌ Expected 10 tables, found $TABLE_COUNT"
    exit 1
fi

# Validate indexes
echo "📇 Validating indexes..."
INDEX_COUNT=$(psql -d $DB_NAME -t -c "SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public';")

if [ "$INDEX_COUNT" -ge 13 ]; then
    echo "✅ All indexes created ($INDEX_COUNT found)"
else
    echo "❌ Expected at least 13 indexes, found $INDEX_COUNT"
    exit 1
fi

# Validate triggers
echo "⚡ Validating triggers..."
TRIGGER_COUNT=$(psql -d $DB_NAME -t -c "SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_schema = 'public';")

if [ "$TRIGGER_COUNT" -eq 8 ]; then
    echo "✅ All 8 triggers created successfully"
else
    echo "❌ Expected 8 triggers, found $TRIGGER_COUNT"
    exit 1
fi

# Validate foreign keys
echo "🔗 Validating foreign keys..."
FK_COUNT=$(psql -d $DB_NAME -t -c "SELECT COUNT(*) FROM information_schema.table_constraints WHERE constraint_type = 'FOREIGN KEY' AND table_schema = 'public';")

if [ "$FK_COUNT" -ge 10 ]; then
    echo "✅ All foreign keys created ($FK_COUNT found)"
else
    echo "❌ Expected at least 10 foreign keys, found $FK_COUNT"
    exit 1
fi

# Validate check constraints
echo "✔️  Validating check constraints..."
CHECK_COUNT=$(psql -d $DB_NAME -t -c "SELECT COUNT(*) FROM information_schema.check_constraints WHERE constraint_schema = 'public';")

if [ "$CHECK_COUNT" -ge 5 ]; then
    echo "✅ Check constraints created ($CHECK_COUNT found)"
else
    echo "❌ Expected at least 5 check constraints, found $CHECK_COUNT"
    exit 1
fi

# List all tables
echo ""
echo "📋 Tables created:"
psql -d $DB_NAME -c "\dt" | grep public

# Cleanup
echo ""
echo "🧹 Cleaning up..."
dropdb $DB_NAME

echo ""
echo "✅ Schema validation completed successfully!"
echo ""
echo "Summary:"
echo "  - 10 tables created"
echo "  - $INDEX_COUNT indexes"
echo "  - 8 triggers"
echo "  - $FK_COUNT foreign keys"
echo "  - $CHECK_COUNT check constraints"
