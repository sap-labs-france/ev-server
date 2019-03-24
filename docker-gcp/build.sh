#!/usr/bin/env bash

docker build -t evserver:1.0 --build-arg build=prod -f ev_server.Dockerfile .
