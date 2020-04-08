PROJECT_NAME?=evse
NAME:=server
DOCKER_ECR_REGISTRY?=166296450311.dkr.ecr.eu-west-3.amazonaws.com
DOCKER_ECR_REGISTRY_NAME?=ev_server

.PHONY: all

default: all

mongo-express:
	docker-compose -p $(PROJECT_NAME) -f docker-compose-mongo-express.yml up -d

local-env: mongo-express
	docker-compose -p $(PROJECT_NAME) -f docker-compose-local-env.yml up -d

submodule-update:
	git submodule update --init --recursive

$(NAME): submodule-update
	docker-compose -p $(PROJECT_NAME) -f docker-compose-$(NAME).yml up -d

$(NAME)-force: submodule-update
	docker-compose -p $(PROJECT_NAME) -f docker-compose-$(NAME).yml up -d --build --force-recreate

$(NAME)-standalone: submodule-update
	docker-compose -p $(PROJECT_NAME) -f docker-compose-$(NAME)-standalone.yml up -d

$(NAME)-standalone-force: submodule-update
	docker-compose -p $(PROJECT_NAME) -f docker-compose-$(NAME)-standalone.yml up -d --build --force-recreate

all: local-env $(NAME)

clean-mongo-express-container:
	-docker-compose -p $(PROJECT_NAME) -f docker-compose-mongo-express.yml down

clean-local-env-containers: clean-mongo-express-container
	-docker-compose -p $(PROJECT_NAME) -f docker-compose-local-env.yml down

clean-$(NAME)-container:
	-docker-compose -p $(PROJECT_NAME) -f docker-compose-$(NAME).yml down

clean-$(NAME)-standalone-container:
	-docker-compose -p $(PROJECT_NAME) -f docker-compose-$(NAME)-standalone.yml down

clean-containers: clean-local-env-containers clean-$(NAME)-container clean-$(NAME)-standalone-container

clean-mongo-express-image:
	-docker rmi mongo-express

clean-local-env-images: clean-mongo-express-image
	-docker rmi mongo:4.2
	-docker rmi $(PROJECT_NAME)_enablereplset
	-docker rmi maildev/maildev

clean-$(NAME)-image:
	-docker rmi $(PROJECT_NAME)_$(NAME)

clean-$(NAME)-standalone-image:
	-docker rmi $(PROJECT_NAME)_$(NAME)-standalone

clean-images: clean-local-env-images clean-$(NAME)-image clean-$(NAME)-standalone-image

clean-mongo-data:
	-docker volume rm $(PROJECT_NAME)_mongo-data

clean-mongo-express: clean-mongo-express-container clean-mongo-express-image

clean-local-env: clean-local-env-containers clean-local-env-images

clean-$(NAME): clean-$(NAME)-container clean-$(NAME)-image

clean-$(NAME)-standalone: clean-$(NAME)-standalone-container clean-$(NAME)-standalone-image

clean: clean-containers clean-images

$(NAME)-docker-ecr-tag:
	docker tag $(PROJECT_NAME)_$(NAME):latest $(DOCKER_ECR_REGISTRY)/$(DOCKER_ECR_REGISTRY_NAME):latest

$(NAME)-docker-ecr-push: $(NAME)-force $(NAME)-docker-ecr-tag
	aws ecr get-login-password --region eu-west-3 | docker login --username AWS --password-stdin $(DOCKER_ECR_REGISTRY)/$(DOCKER_ECR_REGISTRY_NAME)
	docker push $(DOCKER_ECR_REGISTRY)/$(DOCKER_ECR_REGISTRY_NAME):latest

$(NAME)-standalone-docker-ecr-tag:
	docker tag $(PROJECT_NAME)_$(NAME)-standalone:latest $(DOCKER_ECR_REGISTRY)/$(DOCKER_ECR_REGISTRY_NAME):latest

$(NAME)-standalone-docker-ecr-push: $(NAME)-standalone-force $(NAME)-standalone-docker-ecr-tag
	aws ecr get-login-password --region eu-west-3 | docker login --username AWS --password-stdin $(DOCKER_ECR_REGISTRY)/$(DOCKER_ECR_REGISTRY_NAME)
	docker push $(DOCKER_ECR_REGISTRY)/$(DOCKER_ECR_REGISTRY_NAME):latest

dist-clean-images:
	docker image prune -a -f

dist-clean-volumes:
	docker volume prune -f

dist-clean: clean-containers dist-clean-volumes dist-clean-images
