module.exports.email = {
	"subject": "Your vehicle is successfully connected to <%- chargingBoxID %>",
	"baseURL": "<%- evseDashboardURL %>",
	"body": {
		"header": {
			"title": "Successfully Connected!",
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
			"Your electric vehicle is successfully connected to <b><%- chargingBoxID %></b>."
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
	"subject": "Votre véhicule est correctement connecté sur <%- chargingBoxID %>",
	"baseURL": "<%- evseDashboardURL %>",
	"body": {
		"header": {
			"title": "Connecté avec Succès!",
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
			"Votre véhicule électrique est correctement connecté sur <b><%- chargingBoxID %></b>."
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
