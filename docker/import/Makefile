PROJECT_NAME:=evse
NAME:=mongo-tools

.PHONY: mongo-tools

default: mongo-tools

mongo-tools:
  docker build -t $(PROJECT_NAME)$(NAME) .

mongo-tools-cf-push:
  cf push
