module.exports.email = {
  "subject": "<%- chargeBoxID %> - Connector <%- connectorId %> - <%- error %>",
  "baseURL": "<%- evseDashboardURL %>",
  "body": {
    "header": {
      "title": "Charging Station Error",
      "image": {
        "left": {
          "height": 60,
          "url": "<%- evseDashboardURL %>/assets/img/logo-email.gif"
        },
        "right": {
          "height": 50,
          "url": "<%- evseDashboardURL %>/assets/img/info.png"
        }
      }
    },
    "beforeActionLines": [
      "Hi Admin,",
      "",
      "Error occurred on <b><%- chargeBoxID %></b> - <b>Connector <%- connectorId %></b>: <b><%- error %></b>."
    ],
    "action": {
      "title": "View Error",
      "url": "<%- evseDashboardChargingStationURL %>"
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
  "subject": "<%- chargeBoxID %> - Connecteur <%- connectorId %> - <%- error %>",
  "baseURL": "<%- evseDashboardURL %>",
  "body": {
    "header": {
      "title": "Erreur Borne",
      "image": {
        "left": {
          "height": 60,
          "url": "<%- evseDashboardURL %>/assets/img/logo-email.gif"
        },
        "right": {
          "height": 50,
          "url": "<%- evseDashboardURL %>/assets/img/info.png"
        }
      }
    },
    "beforeActionLines": [
      "Bonjour Admin,",
      "",
      "Une erreur est survenue sur <b><%- chargeBoxID %></b> - <b>Connector <%- connectorId %></b>: <b><%- error %></b>."
    ],
    "action": {
      "title": "Voir Erreur",
      "url": "<%- evseDashboardChargingStationURL %>"
    },
    "afterActionLines": [
      "Cordialement,",
      "EV Admin."
    ],
    "footer": {
    }
  }
};
