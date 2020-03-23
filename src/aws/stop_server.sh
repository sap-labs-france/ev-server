#!/usr/bin/env bash

if [ -e /etc/environment_emobility.sh ]
then
  . /etc/environment_emobility.sh
else
  echo "/etc/environment_emobility.sh file not found, exiting"
  exit 1
fi

proc_name="node"
killall $proc_name
