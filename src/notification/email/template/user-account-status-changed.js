module.exports.email = {
  "subject": "Account <%- (user.status === 'A' ? 'activated' : 'suspended'); %>",
  "baseURL": "<%- evseDashboardURL %>",
  "body": {
    "header": {
      "title": "Account <%- (user.status === 'A' ? 'Active' : 'Supended'); %>!",
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
      "Hi <%- (user.firstName ? user.firstName : user.name) %>,",
      "",
      "Your account has been <b><%- (user.status === 'A' ? 'activated' : 'suspended'); %></b> by an administrator."
    ],
    "action": {
      "title": "Charge-Angels",
      "url": "<%- evseDashboardURL %>"
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
  "subject": "Compte <%- (user.status==='A'?'activé':'suspendu'); %>",
  "baseURL": "<%- evseDashboardURL %>",
  "body": {
    "header": {
      "title": "Compte <%- (user.status === 'A' ? 'Activé' : 'Suspendu'); %>!",
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
      "Bonjour <%- (user.firstName ? user.firstName : user.name) %>,",
      "",
      "Votre compte a été <b><%- (user.status === 'A' ? 'activé' : 'suspendu'); %></b> par un administrateur."
    ],
    "action": {
      "title": "Charge-Angels",
      "url": "<%- evseDashboardURL %>"
    },
    "afterActionLines": [
      "Cordialement,",
      "EV Admin."
    ],
    "footer": {
    }
  }
};
