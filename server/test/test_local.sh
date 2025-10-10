#!/bin/bash
set -e
echo "start UT"
WHEEL_TEST_REMOTEHOST=testServer WHEEL_TEST_REMOTE_PASSWORD=passw0rd npm run test