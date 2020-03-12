#!/usr/bin/env bash

[ -n $emobility_install_dir ] && { echo "emobility installation directory env variable not found, exiting"; exit 1; }
[ -n $emobility_landscape ] && { echo "emobility landscape env variable not found, exiting"; exit 1; }
[ -n $emobility_service_type ] && { echo "emobility env service type variable not found, exiting"; exit 1; }

if [ -d $emobility_install_dir ]; then
  rm -rf $emobility_install_dir
fi
mkdir -p $emobility_install_dir
