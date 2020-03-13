#!/usr/bin/env bash

if [ -e /etc/environment_emobility.sh ]
then
  . /etc/environment_emobility.sh
else
  echo "/etc/environment_emobility.sh file not found, fallback to hardcoded values"
  emobility_install_dir="/opt/server"
  emobility_user="ubuntu"
fi

[ -z $emobility_install_dir ] && { echo "emobility installation directory env variable not found, exiting"; exit 1; }
[ -z $emobility_user ] && { echo "emobility user env variable not found, exiting"; exit 1; }

if [ -d $emobility_install_dir ]; then
  rm -rf $emobility_install_dir
fi
mkdir -p $emobility_install_dir
chown $emobility_user.$emobility_user $emobility_install_dir

if [ -d /etc/authbind/byuid ]
then
  cat << EOF > /etc/authbind/byuid/$(id -u $emobility_user)
::/0,80
EOF
else
  echo "authbind is not installed, exiting"
  exit 1
fi
