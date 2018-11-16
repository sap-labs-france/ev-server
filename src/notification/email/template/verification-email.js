module.exports.email = {
  "subject": "Account activation",
  "baseURL": "<%- evseDashboardURL %>",
  "body": {
    "header": {
      "title": "Account Activation",
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
      "You have initiated a request to activate your account.",
      "",
      "Click on the link below to complete the activation."
    ],
    "action": {
      "title": "Activate your Account",
      "url": "<%- evseDashboardVerifyEmailURL %>"
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
  "subject": "Activation de votre compte",
  "baseURL": "<%- evseDashboardURL %>",
  "body": {
    "header": {
      "title": "Activation Compte",
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
      "Vous avez initié une demande d'activation de votre compte.",
      "",
      "Cliquez sur le lien ci-dessous pour compléter l'activation."
    ],
    "action": {
      "title": "Activez votre Compte",
      "url": "<%- evseDashboardVerifyEmailURL %>"
    },
    "afterActionLines": [
      "Cordialement,",
      "EV Admin."
    ],
    "footer": {
    }
  }
};
