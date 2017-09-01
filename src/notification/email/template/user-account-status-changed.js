module.exports.subject = "EVSE - Your account has been <%= (user.status==='A'?'activated':'suspended'); %>";
module.exports.html = `
  <html>
    <body>
      Hi <%= (user.firstName?user.firstName:user.name) %>,</br>
      </br>
      Your account has been <%= (user.status==='A'?"activated":"suspended"); %> by an administrator.</br>
      </br>
      <% if (user.status==='A') { %>
      You can now access the <a href="<%= evseDashboardURL %>">EVSE Dashboard</a>!</br>
      <% } %>
      </br>
      Best Regards,</br>
      EVSE Admin.
    </body>
  </html>
`;

module.exports.fr_FR = {};
module.exports.fr_FR.subject = "EVSE - Votre compte a été <%= (user.status==='A'?'activé':'suspendu'); %>";
module.exports.fr_FR.html = `
  <html>
    <body>
      Bonjour <%= (user.firstName?user.firstName:user.name) %>,</br>
      </br>
      Votre compte a été <%= (user.status==='A'?"activé":"suspendu"); %> par un administrateur.</br>
      </br>
      <% if (user.status==='A') { %>
      Vous pouvez maintenant accéder à l'<a href="<%= evseDashboardURL %>">EVSE Dashboard</a> !</br>
      </br>
      <% } %>
      Cordialement,</br>
      EVSE Admin.
    </body>
  </html>
`;
