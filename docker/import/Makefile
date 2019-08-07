PROJECT_NAME:=evse
NAME:=mongo-tools
DOCKER_USER:=fraggle0
DOCKER_PASSWORD:=$$Love79!

.PHONY: $(NAME)-start

default: $(NAME)-start

$(NAME)-build:
	docker build -t $(PROJECT_NAME)-$(NAME) .

$(NAME)-start: $(NAME)-build
	docker run -d $(PROJECT_NAME)-$(NAME)

clean-$(NAME)-image:
	-docker rmi $(PROJECT_NAME)-$(NAME)

clean-mongodb-image:
	-docker rmi mongo:4.0

clean-$(NAME)-containers:
	-docker ps -a | awk '{ print $$1,$$2 }' | grep $(PROJECT_NAME)-$(NAME) | awk '{print $$1 }' | xargs -I {} docker rm --force {}

clean clean-$(NAME): clean-$(NAME)-containers clean-mongodb-image clean-$(NAME)-image

$(NAME)-docker-tag:
	docker tag $(PROJECT_NAME)-$(NAME) $(DOCKER_USER)/$(PROJECT_NAME)-$(NAME)

$(NAME)-docker-push: $(NAME)-docker-tag
	docker push $(DOCKER_USER)/$(PROJECT_NAME)-$(NAME)

$(NAME)-cf-push:
	-export CF_DOCKER_PASSWORD=$(DOCKER_PASSWORD)
	-set CF_DOCKER_PASSWORD=$(DOCKER_PASSWORD)
	cf push --docker-image $(DOCKER_USER)/$(PROJECT_NAME)-$(NAME) --docker-username $(DOCKER_USER)

dist-clean-images:
	docker image prune -a -f

dist-clean-volumes:
	docker volume prune -f

dist-clean: clean-$(NAME)-containers dist-clean-volumes dist-clean-images
