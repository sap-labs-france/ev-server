module.exports.email = {
	"subject": "<%- chargingBoxID %> - Unknown user just badged (<%- badgeId %>)",
	"baseURL": "<%- evseDashboardURL %>",
	"body": {
		"header": {
			"title": "Unknown User Badged!",
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
	"baseURL": "<%- evseDashboardURL %>",
	"body": {
		"header": {
			"title": "Utilisateur Inconnu!",
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
