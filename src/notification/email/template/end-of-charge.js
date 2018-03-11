module.exports.email = {
	"subject": "Charge is finished on <%- chargingBoxID %>",
	"body": {
		"header": {
			"title": "Charge Finished",
			"image": {
				"width": 50,
				"height": 50,
				"url": "https://cloud.charge-angels.fr/assets/img/info.png",
				"content": null
			}
		},
		"beforeActionLines": [
			"Hi <%- (user.firstName?user.firstName:user.name) %>,",
			"",
			"Your electric vehicle, which is connected to '<%- chargingBoxID %>', has finished charging.",
			"",
			"The total consumption is: <b><%- totalConsumption %> kW.h</b>.",
			"",
			"You can now stop the session and move your car."
		],
		"action": {
			"title": "View Session",
			"url": "<%- evseDashboardChargingStationURL %>"
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
	"subject": "La charge est terminée sur <%- chargingBoxID %>",
	"body": {
		"header": {
			"title": "Charge Terminée",
			"image": {
				"width": 50,
				"height": 50,
				"url": "https://cloud.charge-angels.fr/assets/img/info.png",
				"content": null
			}
		},
		"beforeActionLines": [
			"Bonjour <%- (user.firstName?user.firstName:user.name) %>,",
			"",
			"Votre véhicule électrique, qui est connecté sur '<%- chargingBoxID %>', a terminé sa charge.",
			"",
			"La consommation totale est de : <b><%- totalConsumption %> kW.h</b>.",
			"",
			"Vous pouvez maintenant stopper la session et deplacer votre vehicule."
		],
		"action": {
			"title": "Voir Session",
			"url": "<%- evseDashboardChargingStationURL %>"
		},
		"afterActionLines": [
			"Cordialement,",
			"EV Admin."
		],
		"footer": {
		}
	}
};
