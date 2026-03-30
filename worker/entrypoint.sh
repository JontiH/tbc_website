#!/bin/sh
# Write wrangler .dev.vars from environment variables for local dev.
# GOOGLE_PRIVATE_KEY must be JSON-quoted (single line with \n) for wrangler to parse correctly.
{
  printf 'GOOGLE_SERVICE_ACCOUNT_EMAIL=%s\n' "$GOOGLE_SERVICE_ACCOUNT_EMAIL"
  # Collapse the PEM to a single line with literal \n so wrangler passes it intact to the worker
  printf 'GOOGLE_PRIVATE_KEY="%s"\n' "$(printf '%s' "$GOOGLE_PRIVATE_KEY" | awk '{printf "%s\\n", $0}')"
  printf 'HIVE_SHEET_ID=%s\n' "$HIVE_SHEET_ID"
  printf 'HIVE_SHEET_RANGE=%s\n' "$HIVE_SHEET_RANGE"
  printf 'MEMBERS_SHEET_ID=%s\n' "$MEMBERS_SHEET_ID"
  printf 'MEMBERS_SHEET_RANGE=%s\n' "$MEMBERS_SHEET_RANGE"
} > /app/.dev.vars

exec wrangler dev --port 8787 --ip 0.0.0.0
