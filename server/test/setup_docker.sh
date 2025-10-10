#!/bin/bash
set -e

TEST_DIR=$(cd $(dirname $0);pwd)
pushd ${TEST_DIR} > /dev/null

TAG_TEST_SERVER=wheel_release_test_server

#
# crate config files
#
WHEEL_CONFIG_DIR=$(mktemp -d tmp.XXXXXXXXXX)
export WHEEL_CONFIG_DIR
echo "export WHEEL_CONFIG_DIR=${WHEEL_CONFIG_DIR}" > .env.test
echo "export WHEEL_ARGS='$1'" >> .env.test


{
echo '[{'
echo '  "name": "testServer",'
echo '  "host": "'${TAG_TEST_SERVER}'",'
echo '  "path": "/home/testuser",'
echo '  "username": "testuser",'
echo '  "numJob": 1,'
echo '  "port": 22,'
echo '  "id": "dummy-id",'
echo '  "jobScheduler": "PBSPro",'
echo '  "renewInterval": 0,'
echo '  "renewDelay": 0,'
echo '  "statusCheckInterval": 10,'
echo '  "maxStatusCheckError": 10,'
echo '  "readyTimeout": 5000'
echo '}]'
} > ${WHEEL_CONFIG_DIR}/remotehost.json


echo boot up test server
sudo -E docker compose up ${TAG_TEST_SERVER} -d --wait --remove-orphans
sudo -E docker exec ${TAG_TEST_SERVER} /opt/pbs/bin/qmgr -c "set server job_history_enable=True"

echo remove entry from known_hosts
ssh-keygen -R 'wheel_release_test_server' 2>/dev/null

popd > /dev/null