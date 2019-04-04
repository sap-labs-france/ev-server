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

clean-server-container:
	-docker-compose -p $(PROJECT_NAME) -f docker-compose-server.yml down

clean-containers: clean-server-container
	-docker-compose -p $(PROJECT_NAME) -f docker-compose-local-env.yml down
	-docker-compose -p $(PROJECT_NAME) -f docker-compose-mongo-express.yml down

clean-server-image:
	-docker rmi $(PROJECT_NAME)_server

clean-mongodb-images:
	-docker rmi mongo:4.0
	-docker rmi $(PROJECT_NAME)_enablereplset

clean-images: clean-mongodb-images clean-server-image
	-docker rmi djfarrelly/maildev
	-docker rmi mongo-express

clean-mongo-data:
	-docker volume rm $(PROJECT_NAME)_mongo-data

clean-server: clean-server-container clean-server-image

clean: clean-containers clean-mongo-data clean-images

dist-clean-images:
	docker image prune -a -f

dist-clean-volumes:
	docker volume prune -a

dist-clean: clean-containers dist-clean-volumes dist-clean-images