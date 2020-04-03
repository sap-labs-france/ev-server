PROJECT_NAME:=evse

.PHONY: all

default: all

mongo-express:
	docker-compose -p $(PROJECT_NAME) -f docker-compose-mongo-express.yml up -d

local-env: mongo-express
	docker-compose -p $(PROJECT_NAME) -f docker-compose-local-env.yml up -d

server:
	git submodule update --init --recursive
	docker-compose -p $(PROJECT_NAME) -f docker-compose-server.yml up -d

server-force:
	git submodule update --init --recursive
	docker-compose -p $(PROJECT_NAME) -f docker-compose-server.yml up -d --build --force-recreate

all: local-env server

clean-mongo-express-container:
	-docker-compose -p $(PROJECT_NAME) -f docker-compose-mongo-express.yml down

clean-local-env-containers: clean-mongo-express-container
	-docker-compose -p $(PROJECT_NAME) -f docker-compose-local-env.yml down

clean-server-container:
	-docker-compose -p $(PROJECT_NAME) -f docker-compose-server.yml down

clean-containers: clean-local-env-containers clean-server-container

clean-mongo-express-image:
	-docker rmi mongo-express

clean-local-env-images: clean-mongo-express-image
	-docker rmi mongo:4.2
	-docker rmi $(PROJECT_NAME)_enablereplset
	-docker rmi maildev/maildev

clean-server-image:
	-docker rmi $(PROJECT_NAME)_server

clean-images: clean-local-env-images clean-server-image

clean-mongo-data:
	-docker volume rm $(PROJECT_NAME)_mongo-data

clean-mongo-express: clean-mongo-express-container clean-mongo-express-image

clean-local-env: clean-local-env-containers clean-local-env-images

clean-server: clean-server-container clean-server-image

clean: clean-containers clean-images

dist-clean-images:
	docker image prune -a -f

dist-clean-volumes:
	docker volume prune -f

dist-clean: clean-containers dist-clean-volumes dist-clean-images
