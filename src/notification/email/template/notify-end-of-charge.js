module.exports.subject = "EVSE - Your electric vehicule is fully charged";
module.exports.html = `
  <html>
    <body>
      Hi <%= (user.firstName?user.firstName:user.name) %>,</br>
      </br>
      Your electric vehicle which is connected to the charging station <%= chargingStationId %> is fully charged!</br>
      </br>
      <% if (notifStopTransactionAndUnlockConnector) { %>
        The transaction has been automatically stopped and the connector unlocked.</br>
        </br>
      <% } else { %>
        You can now stop the transaction and unlock the connector.</br>
        </br>
      <% } %>
      You can check the status here: <a href="<%= evseDashboardChargingStationURL %>"><%= chargingStationId %> - Connector <%= connectorId %></a></br>
      </br>
      Best Regards,</br>
      EVSE Admin.
    </body>
  </html>
`;

module.exports.fr_FR = {};
module.exports.fr_FR.subject = "EVSE - La charge de votre véhicule électrique est terminée";
module.exports.fr_FR.html = `
  <html>
    <body>
      Bonjour <%= (user.firstName?user.firstName:user.name) %>,</br>
      </br>
      Votre véhicule électrique qui est connecté sur la borne <%= chargingStationId %> a terminé sa charge !</br>
      </br>
      <% if (notifStopTransactionAndUnlockConnector) { %>
        La transaction a été automatiquement stoppée et le connecteur dévérouillé.</br>
        </br>
      <% } else { %>
        Vous pouvez dès maintenant stopper la transaction et devérouiller le connecteur.</br>
        </br>
      <% } %>
      Vous pouvez verifier son statut içi : <a href="<%= evseDashboardChargingStationURL %>"><%= chargingStationId %> - Connecteur <%= connectorId %></a></br>
      </br>
      Cordialement,</br>
      EVSE Admin.
    </body>
  </html>
`;
