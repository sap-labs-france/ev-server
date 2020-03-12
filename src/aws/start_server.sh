#!/usr/bin/env bash

cd $emobility_install_dir
node -r source-map-support/register --stack-trace-limit=1024 dist/start.js
