module.exports.email = {
  "subject": "Session finished",
  "baseURL": "<%- evseDashboardURL %>",
  "body": {
    "header": {
      "title": "Session Finished!",
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
      "Hi <%- (user.firstName?user.firstName:user.name) %>,",
      "",
      "Your session on <b><%- chargingBoxID %></b> is finished."
    ],
    "stats": [
      { "label": "Consumption", "value": "<%- totalConsumption %> kW.h" },
      { "label": "Total Duration", "value": "<%- totalDuration %>" },
      { "label": "Total Inactivity", "value": "<%- totalInactivity %>" }
    ],
    "action": {
      "title": "View Session",
      "url": "<%- evseDashboardChargingStationURL %>"
    },
    "afterActionLines": [
      "<%- (alternateUser ? 'The user <b>' + (alternateUser.firstName ? alternateUser.name + ' ' + alternateUser.firstName : alternateUser.name) + '</b> has stopped your session.' : '') %>",
      "",
      "Best Regards,",
      "EV Admin."
    ],
    "footer": {
    }
  }
};

module.exports.fr_FR = {};
module.exports.fr_FR.email = {
  "subject": "Session terminée",
  "baseURL": "<%- evseDashboardURL %>",
  "body": {
    "header": {
      "title": "Session Terminée!",
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
      "Bonjour <%- (user.firstName?user.firstName:user.name) %>,",
      "",
      "Votre session sur <b><%- chargingBoxID %></b> est terminée."
    ],
    "stats": [
      { "label": "Consommation", "value": "<%- totalConsumption %> kW.h" },
      { "label": "Durée Totale", "value": "<%- totalDuration %>" },
      { "label": "Inactivité Totale", "value": "<%- totalInactivity %>" }
    ],
    "action": {
      "title": "Voir Session",
      "url": "<%- evseDashboardChargingStationURL %>"
    },
    "afterActionLines": [
      "<%- (alternateUser ? 'L&#39;utilisateur <b>' + (alternateUser.firstName ? alternateUser.name + ' ' + alternateUser.firstName : alternateUser.name) + '</b> a stoppé votre session.' : '') %>",
      "",
      "Cordialement,",
      "EV Admin."
    ],
    "footer": {
    }
  }
};
