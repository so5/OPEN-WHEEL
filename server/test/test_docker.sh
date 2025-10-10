#!/bin/bash
set -e
TAG=wheel_release_test
if [ x$1 == x-d ];then
  export WHEEL_KEEP_FILES_AFTER_LAST_TEST=1
fi
sudo -E docker compose run -e WHEEL_KEEP_FILES_AFTER_LAST_TEST --build ${TAG}