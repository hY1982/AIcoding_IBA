#!/bin/bash
set -e

echo "Running Jest tests inside backend container..."
docker-compose -f docker-compose.dev.yml run --rm backend npm test
