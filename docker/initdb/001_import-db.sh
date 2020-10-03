#!/usr/bin/env bash

unzip -d ${mongodb_home} ${mongodb_home}/${export_file}
mongorestore -d ${mongodb_name} --authenticationDatabase admin --username ${MONGO_INITDB_ROOT_USERNAME} \
             --password ${MONGO_INITDB_ROOT_PASSWORD} --gzip ${mongodb_home}/${mongodb_name}
rm -rf ${mongodb_home}/${export_file} ${mongodb_home}/${mongodb_name}
