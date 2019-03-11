#!/usr/bin/env bash

export_file="export-empty-evse-db.zip"
mongodb_home=/home/mongodb
mongodb_name="evse"

unzip -d ${mongodb_home} ${mongodb_home}/${export_file}
mongorestore -d ${mongodb_name} --authenticationDatabase admin --username admin --password admin --gzip ${mongodb_home}/${mongodb_name}
rm -rf ${mongodb_home}/${export_file} ${mongodb_home}/${mongodb_name}