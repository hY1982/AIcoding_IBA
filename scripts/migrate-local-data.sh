#!/bin/bash
set -e

echo "Exporting data from local PostgreSQL (localhost:5432)..."
PGPASSWORD=postgres pg_dump -h localhost -p 5432 -U postgres -d basketball_platform -f /tmp/basketball_platform_backup.sql

echo "Copying backup into Docker container..."
docker cp /tmp/basketball_platform_backup.sql basketball-postgres:/tmp/backup.sql

echo "Importing data into Docker PostgreSQL..."
docker-compose -f docker-compose.dev.yml exec -T postgres psql -U postgres -d basketball_platform -f /tmp/backup.sql

echo "Data migration completed."
