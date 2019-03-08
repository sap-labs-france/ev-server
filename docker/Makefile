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

clean-mongo-data:
	-docker volume rm $(PROJECT_NAME)_mongo-data
	docker volume prune -f

clean:
	-docker-compose -p $(PROJECT_NAME) -f docker-compose-local-env.yml down
	-docker-compose -p $(PROJECT_NAME) -f docker-compose-server.yml down
	-docker-compose -p $(PROJECT_NAME) -f docker-compose-mongo-express.yml down

dist-clean: clean clean-mongo-data
	docker image prune -a -f