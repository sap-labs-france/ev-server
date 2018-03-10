module.exports.email = {
	"subject": "Your vehicle is successfully connected to <%= chargingBoxID %>",
	"body": {
		"header": {
			"title": "Successfully Connected!",
			"image": {
				"width": 50,
				"height": 50,
				"url": "https://cloud.charge-angels.fr/assets/img/info.png",
				"content": null
			}
		},
		"beforeActionLines": [
			"Hi <%= (user.firstName?user.firstName:user.name) %>,",
			"",
			"Your electric vehicle is successfully connected to '<%= chargingBoxID %>'."
		],
		"action": {
			"title": "View Session",
			"url": "<%= evseDashboardChargingStationURL %>"
		},
		"afterActionLines": [
			"Best Regards,",
			"EV Admin."
		],
		"footer": {
		}
	}
};

module.exports.fr_FR = {};
module.exports.fr_FR.email = {
	"subject": "Votre véhicule est correctement connecté sur <%= chargingBoxID %>",
	"body": {
		"header": {
			"title": "Connecté avec Succès!",
			"image": {
				"width": 50,
				"height": 50,
				"url": "https://cloud.charge-angels.fr/assets/img/info.png",
				"content": null
			}
		},
		"beforeActionLines": [
			"Bonjour <%= (user.firstName?user.firstName:user.name) %>,",
			"",
			"Votre véhicule électrique est correctement connecté sur '<%= chargingBoxID %>'."
		],
		"action": {
			"title": "Voir Session",
			"url": "<%= evseDashboardChargingStationURL %>"
		},
		"afterActionLines": [
			"Cordialement,",
			"EV Admin."
		],
		"footer": {
		}
	}
};
