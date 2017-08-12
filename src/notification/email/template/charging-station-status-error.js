module.exports.subject = "EVSE - <%= chargingStationId %> - Connector <%= connectorId %> - <%= error %>";
module.exports.html = `
  <html>
    <body>
      Hi Admins,</br>
      </br>
      The charging station <%= chargingStationId %> has reported a status error on the connector <%= connectorId %>: <b><%= error %></b></br>
      </br>
      You can check the status here: <a href="<%= evseDashboardChargingStationURL %>"><%= chargingStationId %> - Connector <%= connectorId %></a></br>
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
      La borne <%= chargingStationId %> a reporté une erreur de statut sur le connecteur <%= connectorId %>: <b><%= error %></b></br>
      </br>
      Vous pouvez verifier son statut içi : <a href="<%= evseDashboardChargingStationURL %>"><%= chargingStationId %> - Connecteur <%= connectorId %></a></br>
      </br>
      Cordialement,</br>
      EVSE Admin.
    </body>
  </html>
`;
