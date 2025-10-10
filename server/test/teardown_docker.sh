#!/bin/bash
set -e
source .env.test
TAG=wheel_release_test

CONTAINER_NAME=$(sudo -E docker ps -a --filter "ancestor=${TAG}" --format "{{.Names}}")

#get log files from container
if [ "x${WHEEL_ARGS}" == "x-c" ];then
  TEST_DIR=$(cd $(dirname $0);pwd)
  LOG_DIR=$(dirname ${TEST_DIR})/$(date "+%Y%m%d-%H%M")
  mkdir $LOG_DIR
  sudo -E docker cp ${CONTAINER_NAME}:/usr/src/server/coverage $LOG_DIR
fi

if [ -n ${WHEEL_KEEP_FILES_AFTER_LAST_TEST} ];then
  echo copy files after last test to ${TEST_DIR}
  sudo -E docker cp ${CONTAINER_NAME}:/usr/src/server/WHEEL_TEST_TMP ${TEST_DIR}/
fi

sudo -E docker compose down
rm -fr ${WHEEL_CONFIG_DIR}

echo clean up known_hosts
ssh-keygen -R 'wheel_release_test_server' 2>/dev/null
rm .env.test