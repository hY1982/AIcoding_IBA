#!/bin/bash
set -e

echo "Starting PostgreSQL and Redis services..."
docker-compose -f docker-compose.dev.yml up -d postgres redis

echo "Waiting for PostgreSQL to be ready..."
until docker-compose -f docker-compose.dev.yml exec -T postgres pg_isready -U postgres > /dev/null 2>&1; do
  sleep 1
done

echo "Database is ready."
