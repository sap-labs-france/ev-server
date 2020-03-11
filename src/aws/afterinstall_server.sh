#!/usr/bin/env bash

. conf.sh
echo "debug"
echo $install_dir

install_dir=/opt/server

cp $install_dir/dist/assets/configs-aws/config-rest-qa.json $install_dir/dist/assets/config.json

