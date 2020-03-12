#!/usr/bin/env bash

if [ -e /etc/environment_emobility.sh ]
then
  . /etc/environment_emobility.sh
else
  echo "/etc/environment_emobility.sh file not found, exiting"
  exit 1
fi

cd $emobility_install_dir
node -r source-map-support/register --stack-trace-limit=1024 dist/start.js
