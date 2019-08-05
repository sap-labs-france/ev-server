PROJECT_NAME:=evse
NAME:=mongo-tools

.PHONY: mongo-tools-start

default: mongo-tools-start

mongo-tools-build:
	docker build -t $(PROJECT_NAME)-$(NAME) .

mongo-tools-start: mongo-tools-build
	docker run -d $(PROJECT_NAME)-$(NAME)

clean-mongo-tools-image:
	-docker rmi $(PROJECT_NAME)-$(NAME)

clean-mongodb-image:
	-docker rmi mongo:4.0

clean-mongo-tools-containers:
	-docker ps -a | awk '{ print $$1,$$2 }' | grep $(PROJECT_NAME)-$(NAME) | awk '{print $$1 }' | xargs -I {} docker rm --force {}

clean clean-mongo-tools: clean-mongo-tools-containers clean-mongodb-image clean-mongo-tools-image

mongo-tools-cf-push:
	cf push

dist-clean-images:
	docker image prune -a -f

dist-clean-volumes:
	docker volume prune -f

dist-clean: clean-mongo-tools-containers dist-clean-volumes dist-clean-images
