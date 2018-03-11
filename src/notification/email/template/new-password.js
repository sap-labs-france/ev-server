module.exports.email = {
	"subject": "Your password has been reset",
	"body": {
		"header": {
			"title": "New Password",
			"image": {
				"width": 50,
				"height": 50,
				"url": "https://cloud.charge-angels.fr/assets/img/info.png",
				"content": null
			}
		},
		"beforeActionLines": [
			"Hi <%- (user.firstName?user.firstName:user.name) %>,",
			"",
			"Your password has been reset successfully.",
			"",
			"Your new password is: <b><%- newPassword %></b>"
		],
		"action": {
			"title": "Sign in to Charge-Angels",
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
	"subject": "Votre mot de passe a été initialisé avec succès",
	"body": {
		"header": {
			"title": "Nouveau Mot De Passe",
			"image": {
				"width": 50,
				"height": 50,
				"url": "https://cloud.charge-angels.fr/assets/img/info.png",
				"content": null
			}
		},
		"beforeActionLines": [
			"Bonjour <%- (user.firstName?user.firstName:user.name) %>,",
			"",
			"Votre mot de passe a été réinitialisé avec succès.",
			"",
			"Votre nouveau mot de passe est : <b><%- newPassword %></b>"
		],
		"action": {
			"title": "Sign in to Charge-Angels",
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
