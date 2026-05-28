#!/bin/bash
set -e

echo "Running Jest tests with coverage inside backend container..."
docker-compose -f docker-compose.dev.yml run --rm backend npm run test:cov
