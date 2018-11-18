module.exports.email = {
  "subject": "Unknown user",
  "baseURL": "<%- evseDashboardURL %>",
  "body": {
    "header": {
      "title": "Unknown User",
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
      "An unknown user has just badged on <b><%- chargingBoxID %></b> with the badge ID <b><%- badgeId %></b>."
    ],
    "action": {
      "title": "Edit User",
      "url": "<%- evseDashboardUserURL %>"
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
  "subject": "Utilisateur inconnu",
  "baseURL": "<%- evseDashboardURL %>",
  "body": {
    "header": {
      "title": "Utilisateur Inconnu",
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
      "Un utilisateur inconnu vient juste de badger sur <b><%- chargingBoxID %></b> avec le badge ID <b><%- badgeId %></b>."
    ],
    "action": {
      "title": "Editer Utilisateur",
      "url": "<%- evseDashboardUserURL %>"
    },
    "afterActionLines": [
      "Cordialement,",
      "EV Admin."
    ],
    "footer": {
    }
  }
};
