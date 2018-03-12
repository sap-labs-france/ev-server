module.exports.email = {
	"subject": "<%- chargeBoxID %> - Connector <%- connectorId %> - <%- error %>",
	"baseURL": "<%- evseDashboardURL %>",
	"body": {
		"header": {
			"title": "Charger Error",
			"image": {
				"right": {
					"width": 150,
					"height": 50,
					"url": "<%- companyLogo ? companyLogo : evseDashboardURL + '/assets/img/theme/no-logo.jpg' %>"
				}
			}
		},
		"beforeActionLines": [
			"Hi,",
			"",
			"Error occurred on '<%- chargeBoxID %>' - Connector '<%- connectorId %>': <b><%- error %></b>."
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
	"subject": "<%- chargeBoxID %> - Connecteur <%- connectorId %> - <%- error %>",
	"baseURL": "<%- evseDashboardURL %>",
	"body": {
		"header": {
			"title": "Erreur Borne",
			"image": {
				"right": {
					"width": 150,
					"height": 50,
					"url": "<%- companyLogo ? companyLogo : evseDashboardURL + '/assets/img/theme/no-logo.jpg' %>"
				}
			}
		},
		"beforeActionLines": [
			"Bonjour,",
			"",
			"Une erreur est survenue sur '<%- chargeBoxID %>' - Connector '<%- connectorId %>': <b><%- error %></b>."
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
