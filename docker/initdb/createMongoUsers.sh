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
        roles: [
            { 
                role: \"readWrite\", 
                db: \"$DB\" 
            }
        ]
    }
);"

if [ $? -ne 0 ]; then
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

if [ $? -ne 0 ]; then
    echo "Error at creating user"
    exit 1
fi

docker exec --tty mongodb mongo --port $MONGODB_PORT --eval "
db.getCollection('default.users').insert({
  _id: ObjectId(),
  email: 'super.admin@ev.com',
  address: {
    address1: null,
    address2: null,
    postalCode: null,
    city: null,
    department: null,
    region: null,
    country: null,
    coordinates: [
      0,
      0
    ]
  },
  costCenter: null,
  createdBy: null,
  createdOn: ISODate('2020-04-02T00:00:00.000+0000'),
  deleted: false,
  firstName: 'Super',
  iNumber: null,
  issuer: true,
  lastChangedBy: null,
  locale: 'en_US',
  mobile: null,
  name: 'ADMIN',
  notifications: {
    sendSessionStarted: true,
    sendOptimalChargeReached: true,
    sendEndOfCharge: true,
    sendEndOfSession: true,
    sendUserAccountStatusChanged: true,
    sendSessionNotStarted: true,
    sendCarSynchronizationFailed: true,
    sendUserAccountInactivity: true,
    sendPreparingSessionNotStarted: false,
    sendBillingSynchronizationFailed: false,
    sendNewRegisteredUser: false,
    sendUnknownUserBadged: false,
    sendChargingStationStatusError: false,
    sendChargingStationRegistered: false,
    sendOcpiPatchStatusError: false,
    sendOicpPatchStatusError: false,
    sendOfflineChargingStations: false
  },
  phone: null,
  password: '\$2a\$10$/c.TRisu3xPAGkgTL69b7uC4SGXqDIzFJuZgHOB1D.fvXf5h3WWwW',
  passwordBlockedUntil: null,
  passwordResetHash: null,
  passwordWrongNbrTrials: NumberInt(0),
  eulaAcceptedHash: 'c308ac57857ce483ef1bb50fe8c1bc2bc3b5fcf067114c8b4a3a7abf9896c45f',
  eulaAcceptedOn: ISODate('2020-04-02T00:00:00.000+0000'),
  eulaAcceptedVersion: 28,
  role: 'S',
  status: 'A',
  notificationsActive: true
});"

if [ $? -ne 0 ]; then
    echo "Error inserting super admin"
    exit 1
fi