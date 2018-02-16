module.exports.subject = "EVSE - Your electric vehicule is almost charged";
module.exports.html = `
	<html>
		<body>
			Hi <%= (user.firstName?user.firstName:user.name) %>,</br>
			</br>
			Your electric vehicule, connected to the charging station <a href="<%= evseDashboardChargingStationURL %>"><%= chargingBoxID %></a>, will be soon completely charged!</br>
			</br>
			Best Regards,</br>
			EVSE Admin.
		</body>
	</html>
`;

module.exports.fr_FR = {};
module.exports.fr_FR.subject = "EVSE - La charge de votre véhicule électrique est bientôt terminée";
module.exports.fr_FR.html = `
	<html>
		<body>
			Bonjour <%= (user.firstName?user.firstName:user.name) %>,</br>
			</br>
			La charge de votre véhicule électrique, connecté sur la borne <a href="<%= evseDashboardChargingStationURL %>"><%= chargingBoxID %></a>, va bientôt se terminer !</br>
			</br>
			Cordialement,</br>
			EVSE Admin.
		</body>
	</html>
`;
