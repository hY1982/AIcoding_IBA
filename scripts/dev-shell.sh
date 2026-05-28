#!/bin/bash

echo "Opening shell inside backend container..."
docker-compose -f docker-compose.dev.yml exec backend sh
