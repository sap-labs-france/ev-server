PROJECT_NAME:=evse

.PHONY: all

default: all

mongo-express:
	docker stack deploy -c docker-compose-mongo-express.yml $(PROJECT_NAME)

local-env:
	docker stack deploy -c docker-compose-local-env.yml $(PROJECT_NAME)

server:
	docker stack deploy -c docker-compose-server.yml $(PROJECT_NAME)

all: local-env server

clean-images:
	docker image prune -f

clean-volumes:
	docker volume prune -f

clean-mongo-data:
	-docker volume rm $(PROJECT_NAME)_mongo-data

clean-containers:
	docker stack rm $(PROJECT_NAME)

dist-clean: clean-containers clean-mongo-data clean-volumes
	docker image prune -a -f
