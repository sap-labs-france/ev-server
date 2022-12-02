#!/bin/bash

ADMIN_DB="admin"
ADMIN_USERNAME="evse-admin"
ADMIN_PASSWORD="evse-admin-pwd"
MONGODB_PORT=27017

echo "db.getSiblingDB(\"$ADMIN_DB\").createUser({user: \"$ADMIN_USERNAME\",pwd: \"$ADMIN_PASSWORD\",roles: [ { role: \"readWrite\", db: \"$ADMIN_DB\" } ]});"

docker exec --tty mongodb mongo --port $MONGODB_PORT --eval "
db.getSiblingDB(\"$ADMIN_DB\")
    .createUser({
        user: \"$ADMIN_USERNAME\",
        pwd: \"$ADMIN_PASSWORD\",
        roles: [ { 
            role: \"readWrite\", 
            db: \"$ADMIN_DB\" 
            } 
        ]
    }
);"
 
echo "Result $?"
exit 1