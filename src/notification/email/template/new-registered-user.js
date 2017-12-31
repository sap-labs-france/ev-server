module.exports.subject = "EVSE - Your account has been created successfully";
module.exports.html = `
	<html>
		<body>
			Hi <%= (user.firstName?user.firstName:user.name) %>,</br>
			</br>
			Welcome to the <a href="<%= evseDashboardURL %>">EVSE Dashboard</a>!</br>
			</br>
			Your account has been created successfully.</br>
			</br>
			An administrator will verify and activate it.</br>
			</br>
			Best Regards,</br>
			EVSE Admin.
		</body>
	</html>
`;

module.exports.fr_FR = {};
module.exports.fr_FR.subject = "EVSE - Votre compte a été créé avec succès";
module.exports.fr_FR.html = `
	<html>
		<body>
			Bonjour <%= (user.firstName?user.firstName:user.name) %>,</br>
			</br>
			Bienvenue dans l'<a href="<%= evseDashboardURL %>">EVSE Dashboard</a> !</br>
			</br>
			Votre compte a été créé avec succès.</br>
			</br>
			Un administrateur va le vérifier et l'activer.</br>
			</br>
			Cordialement,</br>
			EVSE Admin.
		</body>
	</html>
`;
