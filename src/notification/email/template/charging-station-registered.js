module.exports.email = {
	"subject": "<%- chargeBoxID %> connected",
	"baseURL": "<%- evseDashboardURL %>",
	"body": {
		"header": {
			"title": "Charger Connected!",
			"image": {
				"left": {
					"width": 150,
					"height": 60,
					"url": "<%- evseDashboardURL %>/assets/img/logo-email.gif"
				},
				"right": {
					"width": 50,
					"height": 50,
					"url": "<%- evseDashboardURL %>/assets/img/info.png"
				}
			}
		},
		"beforeActionLines": [
			"Hi Admin,",
			"",
			"<b><%- chargeBoxID %></b> just got connected to the central server."
		],
		"action": {
			"title": "View <%- chargeBoxID %>",
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
	"subject": "<%- chargeBoxID %> connectée",
	"baseURL": "<%- evseDashboardURL %>",
	"body": {
		"header": {
			"title": "Borne Connectée!",
			"image": {
				"left": {
					"width": 150,
					"height": 60,
					"url": "<%- evseDashboardURL %>/assets/img/logo-email.gif"
				},
				"right": {
					"width": 50,
					"height": 50,
					"url": "<%- evseDashboardURL %>/assets/img/info.png"
				}
			}
		},
		"beforeActionLines": [
			"Bonjour Admin,",
			"",
			"<b><%- chargeBoxID %></b> vient de se connecter au central serveur."
		],
		"action": {
			"title": "Voir <%- chargeBoxID %>",
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
