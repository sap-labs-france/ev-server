PROJECT_NAME?=evse
NAME:=server
SUBMODULES_INIT?=true
DOCKER_ECR_ACCOUNT_ID?=166296450311
DOCKER_ECR_REGION?=eu-west-3
DOCKER_ECR_REGISTRY_NAME?=ev_server
DOCKER_ECR_TAG?=latest

.PHONY: all

default: all

mongo-express:
	docker-compose -p $(PROJECT_NAME) -f docker-compose-mongo-express.yml up -d

local-env: mongo-express
	docker-compose -p $(PROJECT_NAME) -f docker-compose-local-env.yml up -d

submodule-update:
	git submodule update --init --recursive

submodules-init=
ifeq '$(SUBMODULES_INIT)' 'true'
	submodules-init += submodule-update
endif

$(NAME): $(submodules-init)
	docker-compose -p $(PROJECT_NAME) -f docker-compose-$(NAME).yml up -d

$(NAME)-force: $(submodules-init)
	docker-compose -p $(PROJECT_NAME) -f docker-compose-$(NAME).yml up -d --build --force-recreate

$(NAME)-standalone: $(submodules-init)
	docker-compose -p $(PROJECT_NAME) -f docker-compose-$(NAME)-standalone.yml up -d

$(NAME)-standalone-force: $(submodules-init)
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

docker-login-ecr:
	aws ecr get-login-password --region $(DOCKER_ECR_REGION) | docker login --username AWS --password-stdin $(DOCKER_ECR_ACCOUNT_ID).dkr.ecr.$(DOCKER_ECR_REGION).amazonaws.com/$(DOCKER_ECR_REGISTRY_NAME)

$(NAME)-docker-tag-ecr:
	docker tag $(PROJECT_NAME)_$(NAME) $(DOCKER_ECR_ACCOUNT_ID).dkr.ecr.$(DOCKER_ECR_REGION).amazonaws.com/$(DOCKER_ECR_REGISTRY_NAME):$(DOCKER_ECR_TAG)

$(NAME)-docker-push-ecr: $(NAME)-force $(NAME)-docker-tag-ecr docker-login-ecr
	docker push $(DOCKER_ECR_ACCOUNT_ID).dkr.ecr.$(DOCKER_ECR_REGION).amazonaws.com/$(DOCKER_ECR_REGISTRY_NAME):$(DOCKER_ECR_TAG)

$(NAME)-standalone-docker-tag-ecr:
	docker tag $(PROJECT_NAME)_$(NAME)-standalone $(DOCKER_ECR_ACCOUNT_ID).dkr.ecr.$(DOCKER_ECR_REGION).amazonaws.com/$(DOCKER_ECR_REGISTRY_NAME):$(DOCKER_ECR_TAG)

$(NAME)-standalone-docker-push-ecr: $(NAME)-standalone-force $(NAME)-standalone-docker-tag-ecr docker-login-ecr
	docker push $(DOCKER_ECR_ACCOUNT_ID).dkr.ecr.$(DOCKER_ECR_REGION).amazonaws.com/$(DOCKER_ECR_REGISTRY_NAME):$(DOCKER_ECR_TAG)

dist-clean-images:
	docker image prune -a -f

dist-clean-volumes:
	docker volume prune -f

dist-clean: clean-containers dist-clean-volumes dist-clean-images
