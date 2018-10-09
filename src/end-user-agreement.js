module.exports = {
	"en": `
		<h3>End-user Agreement Usage of the Charge-Angels Software</h3>
		<h4>General Data Protection Regulation (GDPR)</h4>
		<p><cite> The General Data Protection Regulation (GDPR) is a regulation in EU law on data protection and privacy for
				all individuals within the European Union. <br /> The GDPR aims primarily to give control back to citizens and
				residents over their personal data and to simplify the regulatory environment for international business by
				unifying the regulation within the EU. <br /> When the GDPR takes effect, it will replace the 1995 Data Protection
				Directive. <br /> It was adopted on 27th, April 2016 and it becomes enforceable from 25 May 2018, after a two-year
				transition period. </cite> <br /> <a href="https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32016R0679"
				target="_blank" rel="noopener">Click here for more information</a></p>
		
		<h4>Personal Data</h4>
		<p>Only meaningful data will be stored regarding the usage of the charging stations for each user.<br /> This is
			personal and not sensitive data meaning that no data concerning the racial or ethnic origin, political opinions,
			religious beliefs or other beliefs of a similar nature, member of a trade union, the physical or mental health or
			condition, the sexual life will be stored.</p>
		<p>Exhaustive list:</p>
		<ul>
			<li>First and Last Name</li>
			<li>Email</li>
			<li>Phone and Mobile number</li>
			<li>Badge IDs</li>
			<li>Account Status (active, blocked...)</li>
			<li>User's Role (basic, admin...)</li>
			<li>Langage</li>
			<li>Picture</li>
			<li>Address</li>
			<li>Vehicle Plate ID</li>
			<li>Password (hashed)</li>
			<li>Professional ID Number</li>
			<li>Professional Cost Center</li>
		</ul>
		
		<h4>Business Data</h4>
		<ul>
			<li>Landscape Overview</li>
			<li>Instant and Total Consumption</li>
			<li>Charging Stations' Status</li>
			<li>Charging Curves</li>
			<li>Session Date/Hour and Duration</li>
			<li>Sessions History</li>
			<li>Active Sessions</li>
			<li>Start/Stop of Sessions</li>
		</ul>
		
		<h4>Scenarios</h4>
		<ul>
			<li>Statistics on Usage, Consumption and Cost</li>
			<li>Site Management</li>
			<li>Price Management</li>
			<li>Smart Charging</li>
			<li>Charging Station Booking</li>
			<li>Charging Predictions</li>
			<li>Users / Admin Notifications</li>
			<li>Charge at Home</li>
		</ul>
		
		<h4>Goal of the Data Processing</h4>
		<ul>
			<li>Maximize the usage of the charging stations by the user while keeping the cost low.</li>
			<li>Improve the maintenance of charging stations.</li>
			<li>Develop a charging optimization algorithm to introduce a load management system that enables EVs to charge
				concurrently according site's constraints (site's maximum power...)</li>
			<li>Encourage users to charge at home and eventually get their electricity consumptions refunded for charging their
				professional cars</li>
		</ul>
		
		<h4>Privacy by Design</h4>
		<p>This application has been designed considering all personal data privacy from the beginning.</p>
		
		<h4>Involved Users</h4>
		<p>The users that make use of the charging stations on the monitored site and who registered to the <a href="{{chargeAngelsURL}}"
				target="_blank" rel="noopener">Charge-Angels</a> application.</p>
		
		<h4>Data Processing Target</h4>
		<ul>
			<li>The data processing are for local Site Managers, Data Scientists or Demos to internal/external customers.</li>
			<li>Users access the data only through the secured HTTPs <a href="{{chargeAngelsURL}}" target="_blank" rel="noopener">Charge-Angels</a>
				application.</li>
			<li>SAP Data Scientists receive only the anonymized transactions from an admin to test their charging algorithms.</li>
			<li>For demoing the <a href="{{chargeAngelsURL}}" target="_blank" rel="noopener">Charge-Angels</a> application to
				external people (not SAP), we use a demo user to anonymize all the personal data.</li>
			<li>User's sessions linked to Charge at Home scenario will be pushed to Cloud Revenue systems in Germany for testing
				and trial purposes.</li>
			<li>User's sessions could be processed to predict charging demand on a given site.</li>
		</ul>
		
		<h4>Data Localization</h4>
		<p>The data will be stored on a server in the SAP Cloud Foundry platform that will be physically installed in a country
			belonging to the European Union. <br />
			Today, our SAP Cloud server is hosted in Germany in Frankfurt.</p>
		
		<h4>Right to Oblivion</h4>
		<p>Your personal data will be kept until the end of the user's contract with the company.<br /> 
			Your personal data will be deleted by an administrator after a period of 6 months of inactivity  
			(no transaction has been done during this period.) <br /> 
			In that case, your user's profile will be deleted and all your sessions will be anonymized thus no
			relations can be done anymore with you.</p>
		
		<h4>Security by Default</h4>
		<p>Credentials are required to access the application for all the administrators, standard and demos users. <br /> 
			The data is sent over the network using an encrypted protocol ensuring their confidentiality. <br /> 
			Only administrators are authorized to read, write, edit, delete all the data stored in the server. <br /> 
			Standard users are only authorized to read and edit their own personal data, see the charging stations availability, the current charge,
			the history of their sessions and their statistics. <br /> Your data can be communicated to third parties in case of
			legal inquiry such as "Inspection du travail" or "Services fiscaux" or police services.</p>
		
		<h4>User Consent</h4>
		<p>You must give your explicit consent for us to use your data. <br /> This is done via a checkbox in the log in page
			of the <a href="{{chargeAngelsURL}}" target="_blank" rel="noopener">Charge-Angels</a> application.</p>
		
		<h4>Right to access and correct data</h4>
		<p>You can, upon providing proof of your identity, make an inquiry to the <a href="mailto:dpo@charge-angels.fr">Data
				Privacy Officer</a> or the administrator about the right of accessing your personal data. <br /> 
		You can request, to the <a href="mailto:dpo@charge-angels.fr">Data
				Privacy Officer</a>, that the information concerning your data that is inaccurate, incomplete, equivocal, no longer
			valid, or that the use, communication or keeping of which is prohibited, may be corrected, completed, clarified,
			updated or deleted.</p>
		
		<h4>Right to Object</h4>
		<p>You have the right to object, by contacting the <a href="mailto:dpo@charge-angels.fr">Data Privacy Officer</a> or an administrator, to
			allow or object about the usage of all or part of your data.</p>
		
		<h4>Limit the Data Processing</h4>
		<p>You have the right to limit part of the usage of your data.</p>
		
		<h4>Portability Right</h4>
		<p>You can request, to the <a href="mailto:dpo@charge-angels.fr">Data Privacy Officer</a> or an administrator, the transfer of all or part
			of your personal data in a file which is readable.</p>
	`,

	"fr": `
		<h3>Conditions G&eacute;n&eacute;rales d'Utilisation de l&rsquo;application Charge-Angels</h3>

		<h4>R&egrave;glement G&eacute;n&eacute;ral sur la Protection des Donn&eacute;es (RGPD)</h4>
		<p><cite> Le r&egrave;glement g&eacute;n&eacute;ral sur la protection des donn&eacute;es (RGPD), constitue le texte de
				r&eacute;f&eacute;rence europ&eacute;en en mati&egrave;re de protection des donn&eacute;es &agrave;
				caract&egrave;re personnel. <br /> Il renforce et unifie la protection des donn&eacute;es pour les individus au
				sein de l'Union europ&eacute;enne. <br /> L&rsquo;objectif de l&rsquo;Europe au travers du R&egrave;glement
				G&eacute;n&eacute;ral pour la Protection des Donn&eacute;es est d&rsquo;offrir un cadre renforc&eacute; et
				harmonis&eacute; de la protection des donn&eacute;es tenant compte des r&eacute;centes &eacute;volutions
				technologiques (Big Data, objets connect&eacute;s, Intelligence Artificielle) et des d&eacute;fis, voire questions,
				qui accompagnent ces &eacute;volutions. <br /> Ses dispositions sont directement applicables dans l'ensemble des 28
				&Eacute;tats membres de l'Union europ&eacute;enne &agrave; compter du 25 mai 2018. </cite> <br /> <a href="https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32016R0679"
				target="_blank" rel="noopener">Cliquez ici pour plus d'information</a></p>
		
		<h4>Donn&eacute;es Personnelles</h4>
		<p>Seul les donn&eacute;es importantes seront enregistr&eacute;es concernant l'utilisation des bornes de recharge pour
			chaque utilisateur. <br /> Ces donn&eacute;es sont purement personnelles et non sensibles c'est &agrave; dire
			qu'aucunes donn&eacute;es concernant l&rsquo;origine raciale ou ethnique, les opinions politiques, philosophiques ou
			religieuses, l&rsquo;appartenance syndicale, la sant&eacute; ou la vie sexuelle ne seront enregistr&eacute;es.</p>
		<p>Voil&agrave; la liste exhaustive :</p>
		<ul>
			<li>Nom et Pr&eacute;nom</li>
			<li>Courrier &eacute;lectronique</li>
			<li>T&eacute;l&eacute;phone fixe et Portable</li>
			<li>Num&eacute;ro de badge</li>
			<li>Statut du Compte (actif, suspendu ...)</li>
			<li>R&ocirc;le Utilisateur (basic, administrateur ...)</li>
			<li>Langage</li>
			<li>Photo</li>
			<li>Adresse</li>
			<li>Plaque d'immatriculation du v&eacute;hicule</li>
			<li>Mot de passe (hach&eacute;)</li>
			<li>Num&eacute;ro d'identification professionnel</li>
			<li>Centre de co&ucirc;t professionnel</li>
		</ul>
		
		<h4>Donn&eacute;es M&eacute;tiers</h4>
		<ul>
			<li>Consommation Instantan&eacute;e et Totale</li>
			<li>Statut des Bornes de recharge</li>
			<li>Courbes de Charge</li>
			<li>Date/Heure et Dur&eacute;e des Sessions</li>
			<li>Historique des Sessions</li>
			<li>Sessions Actives</li>
			<li>D&eacute;marrage/Arr&ecirc;t des Sessions</li>
		</ul>
		
		<h4>Sc&eacute;narios</h4>
		<ul>
			<li>Statistiques sur l'Utilisation des Bornes, la Consommation et le Co&ucirc;t</li>
			<li>Gestion des Sites</li>
			<li>Gestion des Tarifs</li>
			<li>Charge Intelligente</li>
			<li>R&eacute;servation de Charge</li>
			<li>Pr&eacute;diction de Charge</li>
			<li>Notifications Utilisateur / Adminitrateur</li>
			<li>Recharge &agrave; la Maison</li>
		</ul>
		
		<h4>Finalit&eacute; du Traitement des Donn&eacute;es</h4>
		<ul>
			<li>Maximiser l'utilisation des bornes par les utilisateurs en gardant des co&ucirc;ts de fonctionnement bas.</li>
			<li>Am&eacute;liorer la maintenance des bornes de recharge.</li>
			<li>D&eacute;velopper un algorithme d'optimisation afin de g&eacute;rer et de contr&ocirc;ler les charges
				concurrentes d&eacute;livr&eacute;es par les bornes en tenant compte des contraintes du site (puissance maximale du
				site...)</li>
			<li>Inciter les utilisateurs &agrave; recharger chez eux pour lib&eacute;rer l'infrastructure et se faire
				eventuellement rembourser leur consommation &eacute;lectrique lors de la recharge de leur v&eacute;hicule
				professionnel</li>
		</ul>
		
		<h4>Protection des Donn&eacute;es d&egrave;s la Conception</h4>
		<p>Cette application a &eacute;t&eacute; con&ccedil;ue d&egrave;s le d&eacute;part en tenant compte des contraintes de
			la protection des donn&eacute;es personnelles.</p>
		<h4>Utilisateurs Impliqu&eacute;s</h4>
		<p>Les utilisateurs faisant usage des bornes de recharge sur le site et ayant proc&eacute;d&eacute; a leur inscription
			dans l'application.</p>
		
		<h4>Destinataires des Traitements des Donn&eacute;es</h4>
		<ul>
			<li>Le traitement des donn&eacute;es est &agrave; destination des managers de sites, des Data Scientists, des
				D&eacute;mos pour les clients internes ou externes</li>
			<li>Les utilsateurs accedent aux donn&eacute;es exclusivement au travers de l'application securis&eacute;e <a href="{{chargeAngelsURL}}"
					target="_blank" rel="noopener">Charge-Angels</a> en HTTPs</li>
			<li>Les Data Scientists recoivent seulement les transactions anonymis&eacute;es envoy&eacute;es par un administrateur
				pour tester leurs algorithmes</li>
			<li>Pour r&eacute;aliser des d&eacute;monstrations de l'application <a href="{{chargeAngelsURL}}" target="_blank" rel="noopener">Charge-Angels</a>
				&agrave; des personnes ext&eacute;rieures, un utilisateur avec le role demo est utilis&eacute; pour anonymizer
				toutes les informations sensibles</li>
			<li>Les sessions des utilisateurs impliqu&eacute;s dans le sc&eacute;narios Recharge &agrave; la Maison pourront
				&ecirc;tre transf&eacute;r&eacute;es vers Concur ou Revenue Cloud en Allemagne &agrave; des fins de tests.</li>
			<li>Les sessions des utilisateurs pourront &ecirc;tre analys&eacute;es afin de pr&eacute;dire la charge sur un site
				donn&eacute;</li>
		</ul>
		
		<h4>Localisation des Donn&eacute;es</h4>
		<p>Les donn&eacute;es seront enregistr&eacute;es sur la plate-forme SAP Cloud Foundry qui sera physiquement
			install&eacute; dans un des pays de l'Union Europ&eacute;enne.<br /> A ce jour, notre serveur SAP Cloud est
			install&eacute; en Allemagne &agrave; Francfort.</p>
		
		<h4>Droit à l'Oubli</h4>
		<p>
			Vos données personnelles seront conservées jusqu'à la fin du contrat de l'utilisateur avec la société.
			<br />
			Vos données personnelles seront supprimées par un administrateur après une période d'inactivité de 6 mois (aucune
			session n'aura été réalisée pendant cette période).
			<br />
			Dans ce cas, votre profil sera supprimé et vos sessions seront anonymisées et plus aucune relation ne pourra être
			établie avec vous.
			<br />
		</p>
		
		<h4>Sécurité par Défaut</h4>
		<p>
			Des identifiants sont requis pour accéder à l'application pour tous les utilisateurs standards, démos et les
			administrateurs.
			<br />
			Les données qui transitent sur le réseau sont protégées par un protocole sécurisé assurant ainsi leur
			confidentialité.
			<br />
			Seuls les administrateurs seront autorisés à lire, écrire, éditer et effacer toutes les données sur le serveur.
			<br />
			Les utilisateurs standards seront seulement autorisés à lire et modifier leurs propres données personnelles, voir la
			disponibilité des bornes de recharge, la charge en cours, l'historique de leurs sessions et leurs statistiques.
			<br />
			Vos données peuvent être communiquées à une tierce partie en cas de demande légale comme par exemple l'inspection du
			travail, les services fiscaux ou la police.
			<br />
		</p>
		
		<h4>Consentement Utilisateur</h4>
		<p>
			Vous devez explicitement donner votre consentement pour nous autoriser à utiliser vos données.
			<br />
			Celui-ci est matérialisé par une case à cocher dans la page de connexion de l'application <a href="{{chargeAngelsURL}}"
				target="_blank">Charge-Angels</a>.
			<br />
		</p>
		
		<h4>Le droit d'Accès et de Correction</h4>
		<p>
			Vous pouvez, sous couvert de prouver votre identité, requérir auprès du <a href="mailto:dpo@charge-angels.fr">Responsable
				des Données Personnelles</a> ou d'un administrateur, l'accès à vos données personnelles.
			<br />
			Vous pouvez aussi requérir a ce que les informations vous concernant qui ne sont pas exactes, incomplètes,
			équivoques, invalides, ou que l'usage, la communication ou la conservation de ce qui est interdit, peuvent être
			corrigées, complétées, clarifiées, mises à jour ou effacées.
			<br />
		</p>
		
		<h4>Le droit d'Opposition</h4>
		<p>
			Vous avez le droit de vous opposer, en contactant le <a href="mailto:dpo@charge-angels.fr">Responsable des Données
				Personnelles</a> ou l'administrateur, à l'utilisation de tout ou partie de vos données.
			<br />
		</p>
		
		<h4>Limiter le Traitement des Données</h4>
		<p>
			Vous avez le droit de limiter une partie de l'utilisation de vos données.
			<br />
		</p>
		
		<h4>Droit a la Portabilité des Données</h4>
		<p>
			Vous avez le droit de demander, au <a href="mailto:dpo@charge-angels.fr">Responsable des Données Personnelles</a> ou à un administrateur, le
			transfert de tout ou partie de vos données personnelles sous forme d'un fichier informatique lisible.
			<br />
		</p>
	`
};
