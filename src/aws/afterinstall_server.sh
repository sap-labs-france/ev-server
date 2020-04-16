#!/usr/bin/env bash

if [ -e /etc/environment_emobility.sh ]
then
  . /etc/environment_emobility.sh
else
  echo "/etc/environment_emobility.sh file not found, exiting"
  exit 1
fi

[ -z $emobility_install_dir ] && { echo "emobility installation directory env variable not found, exiting"; exit 1; }
[ -z $emobility_landscape ] && { echo "emobility landscape env variable not found, exiting"; exit 1; }
[ -z $emobility_server_type ] && { echo "emobility env server type variable not found, exiting"; exit 1; }
[ -z $emobility_service_type ] && { echo "emobility env service type variable not found, exiting"; exit 1; }
[ -z $emobility_user ] && { echo "emobility user env variable not found, exiting"; exit 1; }
[ -z $emobility_group ] && { echo "emobility group env variable not found, exiting"; exit 1; }

sudo cp $emobility_install_dir/src/aws/ev-server.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable ev-server.service
cp $emobility_install_dir/dist/assets/configs-aws/$emobility_server_type-$emobility_service_type-$emobility_landscape.json $emobility_install_dir/dist/assets/config.json
sudo chown $emobility_user.$emobility_group $emobility_install_dir
