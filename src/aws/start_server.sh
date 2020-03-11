#!/usr/bin/env bash

cd /opt/server
node -r source-map-support/register --stack-trace-limit=1024 dist/start.js
