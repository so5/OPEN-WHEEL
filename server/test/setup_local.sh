#!/bin/bash
set -e

TEST_DIR=$(cd $(dirname $0);pwd)
pushd ${TEST_DIR} > /dev/null

export WHEEL_CONFIG_DIR=/tmp/WHEEL_CONFIG_DIR
TAG_TEST_SERVER=wheel_release_test_server

REMOTE_HOSTNAME=127.0.0.1
REMOTE_PORT=4000
echo "export REMOTE_HOSTNAME=${REMOTE_HOSTNAME}" > .env.test
echo "export REMOTE_PORT=${REMOTE_PORT}" >> .env.test

sudo -E docker stop ${TAG_TEST_SERVER} 2>/dev/null

echo "prepareing remotehost"
mkdir -p ${WHEEL_CONFIG_DIR}
{
echo '[{'
echo '  "name": "testServer",'
echo '  "host": "'${REMOTE_HOSTNAME}'",'
echo '  "path": "/home/testuser",'
echo '  "username": "testuser",'
echo '  "numJob": 5,'
echo '  "port": '${REMOTE_PORT}','
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

echo remove entry from known_hosts to avoid error if the entry already exists
ssh-keygen -R '['${REMOTE_HOSTNAME}']:'${REMOTE_PORT} 2>/dev/null

popd > /dev/null