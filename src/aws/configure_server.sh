#!/usr/bin/env bash

# TODO: use env variable
cp /opt/server/dist/assets/configs-aws/config-rest.json /opt/server/dist/assets/config.json
# Workaround Error: Cannot find module '..'
cd /opt/server
npm install
