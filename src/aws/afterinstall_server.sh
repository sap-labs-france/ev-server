#!/usr/bin/env bash

install_dir=/opt/server

cd $install_dir
# FIXME: use CodeBuild build
npm install
npm run build:prod
cp $install_dir/dist/assets/configs-aws/config-rest-qa.json $install_dir/dist/assets/config.json

