module.exports.subject = "EVSE - <% if (hash) { %>Request to reset your password<% } else { %>Your password has been reset successfully<% } %>";
module.exports.html = `
	<html>
		<body>
			Hi <%= (user.firstName?user.firstName:user.name) %>,</br>
			</br>
			<% if (hash) { %>
				You have just requested a new password.</br>
				</br>
				Click on this link to reset your password and receive a new one: <a href="<%= evseDashboardURL + "/#/reset-password?hash=" + hash + "&email=" + email %>">EVSE Dashboard</a></br>
				</br>
				If you haven't requested anything, you can ignore this email.</br>
			<% } else { %>
				Your password has been reset successfully!</br>
				</br>
				Your new password is: <b><%= newPassword %></b></br>
				</br>
				You can now logon to the <a href="<%= evseDashboardURL %>">EVSE Dashboard</a></br>
			<% } %>
			</br>
			Best Regards,</br>
			EVSE Admin.
		</body>
	</html>
`;

module.exports.fr_FR = {};
module.exports.fr_FR.subject = "EVSE - <% if (hash) { %>Requête pour initialiser votre mot de passe<% } else { %>Votre mot de passe a été réinitialisé avec succès<% } %>";
module.exports.fr_FR.html = `
	<html>
		<body>
			Bonjour <%= (user.firstName?user.firstName:user.name) %>,</br>
			</br>
			<% if (hash) { %>
				Vous venez de demander un nouveau mot de passe.</br>
				</br>
				Cliquez sur ce lien pour en générer un nouveau: <a href="<%= evseDashboardURL + "/#/reset-password?hash=" + hash + "&email=" + email %>">EVSE Dashboard</a></br>
				</br>
				Si vous n'êtes par l'auteur de cette rêquete, vous pouvez ignorer cet email.</br>
			<% } else { %>
				Votre mot de passe a été réinitialisé avec succès!</br>
				</br>
				Votre nouveau mot de passe est : <b><%= newPassword %></b></br>
				</br>
				Vous pouvez maintenant vous connecter sur <a href="<%= evseDashboardURL %>">EVSE Dashboard</a></br>
			<% } %>
			</br>
			Cordialement,</br>
			EVSE Admin.
		</body>
	</html>
`;
