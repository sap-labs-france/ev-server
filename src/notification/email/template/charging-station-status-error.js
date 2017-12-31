module.exports.subject = "EVSE - <%= chargingStationId %> - Connector <%= connectorId %> - <%= error %>";
module.exports.html = `
	<html>
		<body>
			Hi Admins,</br>
			</br>
			Error in Charging Station <a href="<%= evseDashboardChargingStationURL %>"><%= chargingStationId %> - Connector <%= connectorId %></a>: <b><%= error %></b></br>
			</br>
			Best Regards,</br>
			EVSE Admin.
		</body>
	</html>
`;

module.exports.fr_FR = {};
module.exports.fr_FR.subject = "EVSE - <%= chargingStationId %> - Connecteur <%= connectorId %> - <%= error %>";
module.exports.fr_FR.html = `
	<html>
		<body>
		Hi Admins,</br>
			</br>
			Erreur sur La borne <a href="<%= evseDashboardChargingStationURL %>"><%= chargingStationId %> - Connector <%= connectorId %></a>: <b><%= error %></b></br>
			</br>
			Cordialement,</br>
			EVSE Admin.
		</body>
	</html>
`;
