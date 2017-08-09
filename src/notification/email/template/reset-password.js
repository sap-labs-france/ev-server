module.exports.subject = "EVSE - Your password has been reset";
module.exports.html = `
  <html>
    <body>
      Hi <%= (user.firstName?user.firstName:user.name) %>,</br>
      </br>
      Your password to access the <a href="<%= evseDashboardURL %>">EVSE Dashboard</a> has been reset successfully!</br>
      </br>
      Your new password is: <span style="bold"><%= newPassword %></span></br>
      </br>
      Best Regards,</br>
      EVSE Admin.
    </body>
  </html>
`;

module.exports.fr_FR = {};
module.exports.fr_FR.subject = "EVSE - Votre mot de passe a été réinitialisé";
module.exports.fr_FR.html = `
  <html>
    <body>
      Bonjour <%= (user.firstName?user.firstName:user.name) %>,</br>
      </br>
      Votre mot de passe pour accéder au <a href="<%= evseDashboardURL %>">EVSE Dashboard</a> a été réinitialisé avec succès !</br>
      </br>
      Votre nouveau mot de passe est : <span class="password"><%= newPassword %></span></br>
      </br>
      Cordialement,</br>
      EVSE Admin.
    </body>
  </html>
`;
