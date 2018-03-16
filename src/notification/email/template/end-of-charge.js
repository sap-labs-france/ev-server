module.exports.email = {
	"subject": "Charge is finished on <%- chargingBoxID %>",
	"baseURL": "<%- evseDashboardURL %>",
	"body": {
		"header": {
			"title": "Charge Finished!",
			"image": {
				"left": {
					"width": 150,
					"height": 60,
					"url": "<%- evseDashboardURL %>/assets/img/angel-wings-email.gif"
				},
				"right": {
					"width": 100,
					"height": 60,
					"url": "<%- evseDashboardURL %>/assets/img/info.png"
				}
			}
		},
		"beforeActionLines": [
			"Hi <%- (user.firstName?user.firstName:user.name) %>,",
			"",
			"Your electric vehicle, which is connected to <b><%- chargingBoxID %></b>, has finished charging."
		],
		"stats": [
			{ "label": "Consumption", "value": "<%- totalConsumption %> kW.h" },
			{ "label": "Current Duration", "value": "<%- totalDuration %>" }
		],
		"action": {
			"title": "View Session",
			"url": "<%- evseDashboardChargingStationURL %>"
		},
		"afterActionLines": [
			"You can now stop the session and move your car.",
			"",
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
	"baseURL": "<%- evseDashboardURL %>",
	"body": {
		"header": {
			"title": "Charge Terminée!",
			"image": {
				"left": {
					"width": 150,
					"height": 60,
					"url": "<%- evseDashboardURL %>/assets/img/angel-wings-email.gif"
				},
				"right": {
					"width": 100,
					"height": 60,
					"url": "<%- evseDashboardURL %>/assets/img/info.png"
				}
			}
		},
		"beforeActionLines": [
			"Bonjour <%- (user.firstName?user.firstName:user.name) %>,",
			"",
			"Votre véhicule électrique, qui est connecté sur <b><%- chargingBoxID %></b>, a terminé sa charge."
		],
		"stats": [
			{ "label": "Consommation", "value": "<%- totalConsumption %> kW.h" },
			{ "label": "Durée Actuelle", "value": "<%- totalDuration %>" }
		],
		"action": {
			"title": "Voir Session",
			"url": "<%- evseDashboardChargingStationURL %>"
		},
		"afterActionLines": [
			"Vous pouvez maintenant stopper la session et deplacer votre véhicule.",
			"",
			"Cordialement,",
			"EV Admin."
		],
		"footer": {
		}
	}
};
