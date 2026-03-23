#!/bin/sh
set -e
node scripts/migrate.js
exec node src/index.js
