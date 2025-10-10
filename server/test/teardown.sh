#!/bin/bash
TEST_DIR=$(cd $(dirname $0);pwd)

docker compose down
rm -fr ${WHEEL_CONFIG_DIR}

echo clean up known_hosts
ssh-keygen -R ${KNOWN_HOSTS} 2>/dev/null
