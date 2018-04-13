module.exports.email = {
	"subject": "Session finished",
	"baseURL": "<%- evseDashboardURL %>",
	"body": {
		"header": {
			"title": "Session Finished!",
			"image": {
				"left": {
					"width": 150,
					"height": 60,
					"url": "<%- evseDashboardURL %>/assets/img/angel-wings-email.gif"
				},
				"right": {
					"width": 50,
					"height": 50,
					"url": "<%- evseDashboardURL %>/assets/img/info.png"
				}
			}
		},
		"beforeActionLines": [
			"Hi <%- (user.firstName?user.firstName:user.name) %>,",
			"",
			"Your session on <b><%- chargingBoxID %></b> is finished."
		],
		"stats": [
			{ "label": "Consumption", "value": "<%- totalConsumption %> kW.h" },
			{ "label": "Total Duration", "value": "<%- totalDuration %>" },
			{ "label": "Total Inactivity", "value": "<%- totalInactivity %>" }
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
	"subject": "Session terminée",
	"baseURL": "<%- evseDashboardURL %>",
	"body": {
		"header": {
			"title": "Session Terminée!",
			"image": {
				"left": {
					"width": 150,
					"height": 60,
					"url": "<%- evseDashboardURL %>/assets/img/angel-wings-email.gif"
				},
				"right": {
					"width": 50,
					"height": 50,
					"url": "<%- evseDashboardURL %>/assets/img/info.png"
				}
			}
		},
		"beforeActionLines": [
			"Bonjour <%- (user.firstName?user.firstName:user.name) %>,",
			"",
			"Votre session sur <b><%- chargingBoxID %></b> est terminée."
		],
		"stats": [
			{ "label": "Consommation", "value": "<%- totalConsumption %> kW.h" },
			{ "label": "Durée Totale", "value": "<%- totalDuration %>" },
			{ "label": "Inactivité Totale", "value": "<%- totalInactivity %>" }
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
