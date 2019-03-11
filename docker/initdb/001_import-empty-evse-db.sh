#!/usr/bin/env bash

unzip -d /home/mongodb /home/mongodb/export-empty-evse-db.zip
mongorestore -d evse --authenticationDatabase admin --username admin --password admin --gzip /home/mongodb/evse
rm -rf /home/mongodb/export-empty-evse-db.zip /home/mongodb/evse