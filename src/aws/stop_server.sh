#!/usr/bin/env bash

proc_name="node"
if pgrep $proc_name; then pkill $proc_name; fi
