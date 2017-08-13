module.exports.subject = "EVSE - Your electric vehicle is connected";
module.exports.html = `
  <html>
    <body>
      Hi <%= (user.firstName?user.firstName:user.name) %>,</br>
      </br>
      Your electric vehicle is connected to the charging station <%= chargingStationId %>, connector <%= connectorId %>!</br>
      </br>
      You can check the status here: <a href="<%= evseDashboardChargingStationURL %>"><%= chargingStationId %> - Connector <%= connectorId %></a></br>
      </br>
      Best Regards,</br>
      EVSE Admin.
    </body>
  </html>
`;

module.exports.fr_FR = {};
module.exports.fr_FR.subject = "EVSE - Votre véhicule électrique est connecté";
module.exports.fr_FR.html = `
  <html>
    <body>
      Bonjour <%= (user.firstName?user.firstName:user.name) %>,</br>
      </br>
      Votre véhicule électrique est connecté sur la borne <%= chargingStationId %>, connecteur <%= connectorId %>!</br>
      </br>
      Vous pouvez verifier son statut içi : <a href="<%= evseDashboardChargingStationURL %>"><%= chargingStationId %> - Connecteur <%= connectorId %></a></br>
      </br>
      Cordialement,</br>
      EVSE Admin.
    </body>
  </html>
`;
