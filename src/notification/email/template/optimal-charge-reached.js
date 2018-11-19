module.exports.email = {
  "subject": "Optimal charge reached",
  "baseURL": "<%- evseDashboardURL %>",
  "body": {
    "header": {
      "title": "Optimal Charge Reached",
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
      "Your electric vehicle, which is connected to <b><%- chargingBoxID %></b>, reached its optimal charge."
    ],
    "stats": [
      { "label": "Battery Level", "value": "<%- stateOfCharge %> %" }
    ],
    "action": {
      "title": "View Session",
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
  "subject": "Charge optimale atteinte",
  "baseURL": "<%- evseDashboardURL %>",
  "body": {
    "header": {
      "title": "Charge Optimale Atteinte",
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
      "Votre véhicule électrique, qui est connecté sur <b><%- chargingBoxID %></b>, a atteint sa charge optimale."
    ],
    "stats": [
      { "label": "Niveau Batterie", "value": "<%- stateOfCharge %> %" }
    ],
    "action": {
      "title": "Voir Session",
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
