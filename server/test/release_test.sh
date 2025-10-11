#!/bin/bash
TEST_DIR=$(cd $(dirname $0);pwd)
pushd ${TEST_DIR}
export WHEEL_CONFIG_DIR=$(mktemp -d tmp.XXXXXXXXXX)

TAG_TEST_SERVER=wheel_release_test_server

source test_setting_docker.txt

docker stop ${TAG_TEST_SERVER} 2>/dev/null
echo "prepareing remotehost"
{
echo '[{'
echo '  "name": "testServer",'
echo '  "host": "'${REMOTE_HOSTNAME}'",'
echo '  "path": "/home/testuser",'
echo '  "username": "testuser",'
echo '  "numJob": "'${NUM_JOB}'",'
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
docker compose up ${TAG_TEST_SERVER} -d --wait --remove-orphans
docker exec ${TAG_TEST_SERVER} /opt/pbs/bin/qmgr -c "set server job_history_enable=True"

echo remove entry from known_hosts to avoid error if the entry already exists
ssh-keygen -R ${KNOWN_HOSTS} 2>/dev/null

echo "start UT"
if [ x$1 == x-d ];then
  export WHEEL_KEEP_FILES_AFTER_LAST_TEST=1
fi
TAG=wheel_release_test #set this image name in compose.yml
docker compose run -e WHEEL_KEEP_FILES_AFTER_LAST_TEST --build ${TAG}
rt=$?
echo "UT finished"

CONTAINER_NAME=$(docker ps -a --filter "ancestor=${TAG}" --format "{{.Names}}")

#get log files from container
if [ x$1 == x-c ];then
  LOG_DIR=$(dirname ${TEST_DIR})/$(date "+%Y%m%d-%H%M")
  mkdir $LOG_DIR
  docker cp ${CONTAINER_NAME}:/usr/src/server/coverage $LOG_DIR
fi

if [ -n ${WHEEL_KEEP_FILES_AFTER_LAST_TEST} ];then
  echo copy files after last test to ${TEST_DIR}
  docker cp ${CONTAINER_NAME}:/usr/src/server/WHEEL_TEST_TMP ${TEST_DIR}/
fi

docker compose down
rm -fr ${WHEEL_CONFIG_DIR}

echo clean up known_hosts
ssh-keygen -R ${KNOWN_HOSTS} 2>/dev/null

exit ${rt}
