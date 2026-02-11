# will attempt to set up database and seed with dev data
#!/bin/bash
set -e

echo "Starting SpendingTracker..."

# Check if migration table exists by attempting to install
echo "Checking database status..."
INSTALL_OUTPUT=$(box migrate install 2>&1) || {
    echo "ERROR: Migration install failed!"
    echo "$INSTALL_OUTPUT"
    exit 1
}

if echo "$INSTALL_OUTPUT" | grep -q "Migration table already installed"; then
  echo "Database already initialized - skipping seeders"
else
  echo "First run detected - running migrations..."
  box migrate up
  box migrate seed run
  echo "Database setup complete!"
fi

# Execute the original CommandBox run script
exec ${BUILD_DIR}/run.sh