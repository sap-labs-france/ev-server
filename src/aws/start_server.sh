#!/usr/bin/env bash

source conf.sh

node -r source-map-support/register --stack-trace-limit=1024 $install_dir/dist/start.js
