PROJECT_NAME:=evse

.PHONY: all

default: all

mongo-express:
	docker-compose -p $(PROJECT_NAME) -f docker-compose-mongo-express.yml up -d

local-env:
	docker-compose -p $(PROJECT_NAME) -f docker-compose-local-env.yml up -d

server:
	docker-compose -p $(PROJECT_NAME) -f docker-compose-server.yml up -d

all: local-env server

clean-mongo-data:
	-docker volume rm $(PROJECT_NAME)_mongo-data

clean-containers:
	-docker-compose -p $(PROJECT_NAME) -f docker-compose-local-env.yml down
	-docker-compose -p $(PROJECT_NAME) -f docker-compose-server.yml down
	-docker-compose -p $(PROJECT_NAME) -f docker-compose-mongo-express.yml down

dist-clean-images:
	docker image prune -a -f

dist-clean-volumes:
	docker volume prune -a

dist-clean: clean-containers dist-clean-volumes dist-clean-images