#!/bin/bash
set -e
source .env.test

echo "UT finished"

sudo -E docker compose down

echo clean up known_hosts
ssh-keygen -R '['${REMOTE_HOSTNAME}']:'${REMOTE_PORT} 2>/dev/null
rm .env.test