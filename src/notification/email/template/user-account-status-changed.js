module.exports.email = {
	"subject": "Your account is <%- (user.status === 'A' ? 'activated' : 'suspended'); %>!",
	"baseURL": "<%- evseDashboardURL %>",
	"body": {
		"header": {
			"title": "Your Account is <%- (user.status === 'A' ? 'Active' : 'Supended'); %>!",
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
			"Hi <%- (user.firstName ? user.firstName : user.name) %>,",
			"",
			"Your account has been <b><%- (user.status === 'A' ? 'activated' : 'suspended'); %></b> by an administrator."
		],
		"action": {
			"title": "Charge-Angels",
			"url": "<%- evseDashboardURL %>"
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
	"subject": "Votre compte est <%- (user.status==='A'?'activé':'suspendu'); %>!",
	"baseURL": "<%- evseDashboardURL %>",
	"body": {
		"header": {
			"title": "Votre Compte est <%- (user.status === 'A' ? 'Activé' : 'Suspendu'); %>!",
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
			"Bonjour <%- (user.firstName ? user.firstName : user.name) %>,",
			"",
			"Votre compte a été <b><%- (user.status === 'A' ? 'activé' : 'suspendu'); %></b> par un administrateur."
		],
		"action": {
			"title": "Charge-Angels",
			"url": "<%- evseDashboardURL %>"
		},
		"afterActionLines": [
			"Cordialement,",
			"EV Admin."
		],
		"footer": {
		}
	}
};
