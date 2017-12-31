module.exports.subject = "EVSE - Your vehicule has finished charging on <%= chargingStationId %>";
module.exports.html = `
	<html>
		<body>
			Hi <%= (user.firstName?user.firstName:user.name) %>,</br>
			</br>
			Your electric vehicle, which is connected to the charging station <a href="<%= evseDashboardChargingStationURL %>"><%= chargingStationId %></a>, has finished charging.</br>
			</br>
			<% if (notifStopTransactionAndUnlockConnector) { %>
				The transaction has been automatically stopped and the connector unlocked.</br>
			<% } else { %>
				You can now stop the transaction and unlock the connector.</br>
			<% } %>
			</br>
			The total consumption is: <b><%= totalConsumption %> kW.h</b>.</br>
			</br>
			Best Regards,</br>
			EVSE Admin.
		</body>
	</html>
`;

module.exports.fr_FR = {};
module.exports.fr_FR.subject = "EVSE - La charge de votre véhicule est terminée sur la borne <%= chargingStationId %>";
module.exports.fr_FR.html = `
	<html>
		<body>
			Bonjour <%= (user.firstName?user.firstName:user.name) %>,</br>
			</br>
			Votre véhicule électrique, qui est connecté sur la borne <a href="<%= evseDashboardChargingStationURL %>"><%= chargingStationId %></a>, a terminé sa charge.</br>
			</br>
			<% if (notifStopTransactionAndUnlockConnector) { %>
				La transaction a été automatiquement stoppée et le connecteur dévérouillé.</br>
			<% } else { %>
				Vous pouvez dès maintenant stopper la transaction et devérouiller le connecteur.</br>
			<% } %>
			</br>
			La consommation totale est de : <b><%= totalConsumption %> kW.h</b>.</br>
			</br>
			Cordialement,</br>
			EVSE Admin.
		</body>
	</html>
`;
