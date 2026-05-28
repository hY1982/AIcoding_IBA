#!/bin/bash
set -e

echo "Running TypeORM migrations inside backend container..."
docker-compose -f docker-compose.dev.yml run --rm backend npm run migration:run
