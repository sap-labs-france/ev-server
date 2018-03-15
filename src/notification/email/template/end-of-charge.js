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
					"url": "chargeAngelsLogo"
				},
				"right": {
					"width": 100,
					"height": 60,
					"url": "<%- companyLogo ? companyLogo : evseDashboardURL + '/assets/img/theme/no-logo.jpg' %>"
				}
			}
		},
		"beforeActionLines": [
			"Hi <%- (user.firstName?user.firstName:user.name) %>,",
			"",
			"Your electric vehicle, which is connected to <b><%- chargingBoxID %></b>, has finished charging.",
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
	"baseURL": "<%- evseDashboardURL %>",
	"body": {
		"header": {
			"title": "Charge Terminée!",
			"image": {
				"left": {
					"width": 150,
					"height": 60,
					"url": "chargeAngelsLogo"
				},
				"right": {
					"width": 100,
					"height": 60,
					"url": "<%- companyLogo ? companyLogo : evseDashboardURL + '/assets/img/theme/no-logo.jpg' %>"
				}
			}
		},
		"beforeActionLines": [
			"Bonjour <%- (user.firstName?user.firstName:user.name) %>,",
			"",
			"Votre véhicule électrique, qui est connecté sur <b><%- chargingBoxID %></b>, a terminé sa charge.",
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
