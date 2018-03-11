module.exports.email = {
	"subject": "<%= chargeBoxID %> - Connector <%= connectorId %> - <%= error %>",
	"body": {
		"header": {
			"title": "Charger Error",
			"image": {
				"width": 50,
				"height": 50,
				"url": "https://cloud.charge-angels.fr/assets/img/info.png",
				"content": null
			}
		},
		"beforeActionLines": [
			"Hi,",
			"",
			"Error occurred on '<%= chargeBoxID %>' - Connector '<%= connectorId %>': <b><%= error %></b>."
		],
		"action": {
			"title": "View Error",
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
	"subject": "<%= chargeBoxID %> - Connecteur <%= connectorId %> - <%= error %>",
	"body": {
		"header": {
			"title": "Erreur Borne",
			"image": {
				"width": 50,
				"height": 50,
				"url": "https://cloud.charge-angels.fr/assets/img/info.png",
				"content": null
			}
		},
		"beforeActionLines": [
			"Bonjour,",
			"",
			"Une erreur est survenue sur '<%= chargeBoxID %>' - Connector '<%= connectorId %>': <b><%= error %></b>."
		],
		"action": {
			"title": "Voir Erreur",
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
