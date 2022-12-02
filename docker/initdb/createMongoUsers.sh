#!/bin/bash

# General conf
MONGODB_PORT=27017

# Admin
DB="admin"
USER="evse-admin"
PASSWORD="evse-admin-pwd"

docker exec --tty mongodb mongo --port $MONGODB_PORT --eval "
db.getSiblingDB(\"$DB\")
    .createUser({
        user: \"$USER\",
        pwd: \"$PASSWORD\",
        roles: [ { 
            role: \"readWrite\", 
            db: \"$DB\" 
            } 
        ]
    }
);"

if [ $? -ne 0]; then
    echo "Error at creating user"
    exit 1
fi

# EVSE
DB="evse"
USER="evse-user"
PASSWORD="evse-user-pwd"

docker exec --tty mongodb mongo --port $MONGODB_PORT --eval "
db.getSiblingDB(\"$DB\")
    .createUser({
        user: \"$USER\",
        pwd: \"$PASSWORD\",
        roles: [ { 
            role: \"readWrite\", 
            db: \"$DB\" 
            } 
        ]
    }
);"

if [ $? -ne 0]; then
    echo "Error at creating user"
    exit 1
fi
