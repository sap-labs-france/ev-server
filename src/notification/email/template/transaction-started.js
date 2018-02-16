module.exports.subject = "EVSE - Your vehicle is successfully connected to <%= chargingBoxID %>";
module.exports.html = `
	<html>
		<body>
			Hi <%= (user.firstName?user.firstName:user.name) %>,</br>
			</br>
			Your electric vehicle is successfully connected to the charging station <a href="<%= evseDashboardChargingStationURL %>"><%= chargingBoxID %></a>.</br>
			</br>
			Best Regards,</br>
			EVSE Admin.
		</body>
	</html>
`;

module.exports.fr_FR = {};
module.exports.fr_FR.subject = "EVSE - Votre véhicule est correctement connecté sur <%= chargingBoxID %>";
module.exports.fr_FR.html = `
	<html>
		<body>
			Bonjour <%= (user.firstName?user.firstName:user.name) %>,</br>
			</br>
			Votre véhicule électrique est correctement connecté sur la borne <a href="<%= evseDashboardChargingStationURL %>"><%= chargingBoxID %></a>.</br>
			</br>
			Cordialement,</br>
			EVSE Admin.
		</body>
	</html>
`;
