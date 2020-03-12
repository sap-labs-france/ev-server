#!/usr/bin/env bash

if [ -e /etc/environment ]
then
  . /etc/environment
else
  echo "/etc/environment file not found, exiting"
  exit 1
fi

proc_name="node"
killall -q $proc_name || true
