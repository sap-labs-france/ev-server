PROJECT_NAME:=evse

.PHONY: all

default: all

mongoexpress:
	docker-compose -p $(PROJECT_NAME) -f docker-compose-mongo-express.yml up -d

local-env:
	docker-compose -p $(PROJECT_NAME) -f docker-compose-local-env.yml up -d

server:
	docker-compose -p $(PROJECT_NAME) -f docker-compose-server.yml up -d

all: local-env server

clean:
	-docker-compose -p $(PROJECT_NAME) -f docker-compose-local-env.yml down
	-docker-compose -p $(PROJECT_NAME) -f docker-compose-server.yml down
	-docker-compose -p $(PROJECT_NAME) -f docker-compose-mongo-express.yml down