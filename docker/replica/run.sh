#!/bin/bash
RET=1
while [[ RET -ne 0 ]]; do
    sleep 1
    echo "Waiting for mongodb..."
    mongo admin --host mongodb --eval "help" >/dev/null 2>&1
    RET=$?
done

echo "initiate replicaset configuration..."
mongo admin --host ev_mongo -u evse-admin -p evse-admin-pwd script.js

