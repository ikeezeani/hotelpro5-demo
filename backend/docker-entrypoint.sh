#!/bin/sh
set -e

echo "── HotelPro 5.0 API — container startup ──"

echo "Step 1/3: waiting for the database..."
node database/waitForDb.js

echo "Step 2/3: applying database schema (safe to re-run — uses CREATE TABLE IF NOT EXISTS)..."
node database/migrate.js

echo "Step 3/3: starting the API server..."
exec node server.js
