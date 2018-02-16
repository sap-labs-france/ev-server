module.exports.subject = "EVSE - <%= chargingBoxID %> - An unknown user has just badged (<%= badgeId %>)";
module.exports.html = `
	<html>
		<body>
			Hi Admins,</br>
			</br>
			An unknown user with badge <%= badgeId %> has just tried to start a transaction on the charging station <%= chargingBoxID %></br>
			</br>
			You can edit his profile here: <a href="<%= evseDashboardUserURL %>">Change user with badge <%= badgeId %></a></br>
			</br>
			Best Regards,</br>
			EVSE Admin.
		</body>
	</html>
`;

module.exports.fr_FR = {};
module.exports.fr_FR.subject = "EVSE - <%= chargingBoxID %> - Un utilisateur inconnu vient juste de badger (<%= badgeId %>)";
module.exports.fr_FR.html = `
	<html>
		<body>
		Hi Admins,</br>
			</br>
			Un utilisateur inconnu avec un badge <%= badgeId %> vient juste d'essayer de demarrer une transaction sur la borne <%= chargingBoxID %></br>
			</br>
			Vous pouvez éditer son profile içi : <a href="<%= evseDashboardUserURL %>">Editer l'utilisateur avec le badge <%= badgeId %></a></br>
			</br>
			Cordialement,</br>
			EVSE Admin.
		</body>
	</html>
`;
