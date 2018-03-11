module.exports.email = {
	"subject": "<%- chargingBoxID %> - Unknown user just badged (<%- badgeId %>)",
	"body": {
		"header": {
			"title": "Unknown User Badged!",
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
			"An unknown user has just badged on '<%- chargingBoxID %>' with the badge ID '<%- badgeId %>'."
		],
		"action": {
			"title": "Edit User",
			"url": "<%- evseDashboardUserURL %>"
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
	"subject": "<%- chargingBoxID %> - Un utilisateur inconnu vient de badger (<%- badgeId %>)",
	"body": {
		"header": {
			"title": "Utilisateur Inconnu!",
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
			"Un utilisateur inconnu vient juste de badger sur '<%- chargingBoxID %>' avec le badge ID '<%- badgeId %>'."
		],
		"action": {
			"title": "Editer Utilisateur",
			"url": "<%- evseDashboardUserURL %>"
		},
		"afterActionLines": [
			"Cordialement,",
			"EV Admin."
		],
		"footer": {
		}
	}
};
