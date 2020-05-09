PROJECT_NAME?=evse
NAME:=mongo-tools
DOCKER_USER?=
DOCKER_PASSWORD?=
DOCKER_TAG?=latest
DOCKER_ECR_ACCOUNT_ID?=166296450311
DOCKER_ECR_REGION?=eu-west-3

.PHONY: $(NAME)-start

default: $(NAME)-start

$(NAME)-build:
	docker build -t $(PROJECT_NAME)_$(NAME) .

$(NAME)-start: $(NAME)-build
	docker run -d $(PROJECT_NAME)_$(NAME)

clean-$(NAME)-image:
	-docker rmi $(PROJECT_NAME)_$(NAME)

clean-mongodb-image:
	-docker rmi mongo:4.2

clean-images clean-$(NAME)-images: clean-mongodb-image clean-$(NAME)-image

clean-$(NAME)-containers:
	-docker ps -a | awk '{ print $$1,$$2 }' | grep $(PROJECT_NAME)_$(NAME) | awk '{print $$1 }' | xargs -I {} docker rm --force {}

clean clean-$(NAME): clean-$(NAME)-containers clean-$(NAME)-images

$(NAME)-docker-tag:
	docker tag $(PROJECT_NAME)_$(NAME) $(DOCKER_USER)/$(PROJECT_NAME)_$(NAME):$(DOCKER_TAG)

$(NAME)-docker-push: $(NAME)-build $(NAME)-docker-tag
	docker push $(DOCKER_USER)/$(PROJECT_NAME)_$(NAME):$(DOCKER_TAG)

$(NAME)-docker-tag-ecr:
	docker tag $(PROJECT_NAME)_$(NAME) $(DOCKER_ECR_ACCOUNT_ID).dkr.ecr.$(DOCKER_ECR_REGION).amazonaws.com/$(NAME):$(DOCKER_TAG)

$(NAME)-docker-push-ecr: $(NAME)-build $(NAME)-docker-tag-ecr
	aws ecr get-login-password --region $(DOCKER_ECR_REGION) | docker login --username AWS --password-stdin $(DOCKER_ECR_ACCOUNT_ID).dkr.ecr.$(DOCKER_ECR_REGION).amazonaws.com/$(NAME)
	docker push $(DOCKER_ECR_ACCOUNT_ID).dkr.ecr.$(DOCKER_ECR_REGION).amazonaws.com/$(NAME):$(DOCKER_TAG)

ifeq ($(OS),Windows_NT)
# FIXME
# $(NAME)-cf-push: set CF_DOCKER_PASSWORD=$(DOCKER_PASSWORD)
else
$(NAME)-cf-push: export CF_DOCKER_PASSWORD=$(DOCKER_PASSWORD)
endif
$(NAME)-cf-push: $(NAME)-docker-push
	cf push --docker-image $(DOCKER_USER)/$(PROJECT_NAME)_$(NAME):$(DOCKER_TAG) --docker-username $(DOCKER_USER)

ifeq ($(OS),Windows_NT)
# FIXME
# $(NAME)-cf-push-only: set CF_DOCKER_PASSWORD=$(DOCKER_PASSWORD)
else
$(NAME)-cf-push-only: export CF_DOCKER_PASSWORD=$(DOCKER_PASSWORD)
endif
$(NAME)-cf-push-only:
	cf push --docker-image $(DOCKER_USER)/$(PROJECT_NAME)_$(NAME):$(DOCKER_TAG) --docker-username $(DOCKER_USER)

dist-clean-images:
	docker image prune -a -f

dist-clean-volumes:
	docker volume prune -f

dist-clean: clean-$(NAME)-containers dist-clean-volumes dist-clean-images
