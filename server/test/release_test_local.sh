#!/bin/bash
set -e
TEST_DIR=$(cd $(dirname $0);pwd)

${TEST_DIR}/setup_local.sh
rt=$?
if [ ${rt} -ne 0 ]; then
  echo "setup failed"
  exit ${rt}
fi
source ${TEST_DIR}/.env.test

${TEST_DIR}/test_local.sh
rt=$?

${TEST_DIR}/teardown_local.sh

exit ${rt}