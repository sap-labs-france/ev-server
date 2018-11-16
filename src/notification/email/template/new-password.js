module.exports.email = {
  "subject": "New password",
  "baseURL": "<%- evseDashboardURL %>",
  "body": {
    "header": {
      "title": "New Password!",
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
      "Your password has been reset successfully.",
      "",
      "Your new password is: <b><%- newPassword %></b>"
    ],
    "action": {
      "title": "Sign in to Charge-Angels",
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
  "subject": "Nouveau mot de passe",
  "baseURL": "<%- evseDashboardURL %>",
  "body": {
    "header": {
      "title": "Nouveau Mot De Passe!",
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
      "Votre mot de passe a été réinitialisé avec succès.",
      "",
      "Votre nouveau mot de passe est : <b><%- newPassword %></b>"
    ],
    "action": {
      "title": "Sign in to Charge-Angels",
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
