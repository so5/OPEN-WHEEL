#!/bin/bash
set -e
TEST_DIR=$(cd $(dirname $0);pwd)

${TEST_DIR}/setup_docker.sh "$1"
rt=$?
if [ ${rt} -ne 0 ]; then
  echo "setup failed"
  exit ${rt}
fi
source ${TEST_DIR}/.env.test

${TEST_DIR}/test_docker.sh "$1"
rt=$?

${TEST_DIR}/teardown_docker.sh "$1"
exit ${rt}