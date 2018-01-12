const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const passwordGenerator = require("password-generator");
const Logging = require('./Logging');
const bcrypt = require('bcrypt');
require('source-map-support').install();

let _userFilename = path.join(__dirname, "../../users.json");
let _userFilenameImported = path.join(__dirname, "../../users-imported.json");

module.exports = {
	// Statuses
	USER_STATUS_PENDING: "P",
	USER_STATUS_ACTIVE: "A",
	USER_STATUS_DELETED: "D",
	USER_STATUS_INACTIVE: "I",
	USER_STATUS_BLOCKED: "B",
	USER_STATUS_LOCKED: "L",

	// Roles
	USER_ROLE_BASIC: "B",
	USER_ROLE_ADMIN: "A",
	USER_ROLE_DEMO: "D",

	// Password constants
	PWD_MIN_LENGTH: 15,
	PWD_MAX_LENGTH: 20,
	PWD_UPPERCASE_MIN_COUNT: 1,
	PWD_LOWERCASE_MIN_COUNT: 1,
	PWD_NUMBER_MIN_COUNT: 1,
	PWD_SPECIAL_MIN_COUNT: 1,

	PWD_UPPERCASE_RE: /([A-Z])/g,
	PWD_LOWERCASE_RE: /([a-z])/g,
	PWD_NUMBER_RE: /([\d])/g,
	PWD_SPECIAL_CHAR_RE: /([!#\$%\^&\*\.\?\-])/g,

	WITH_IMAGE: true,
	WITH_NO_IMAGE: false,

	WITH_ID: true,
	WITHOUT_ID: false,

	isPasswordStrongEnough(password) {
		var uc = password.match(this.PWD_UPPERCASE_RE);
		var lc = password.match(this.PWD_LOWERCASE_RE);
		var n = password.match(this.PWD_NUMBER_RE);
		var sc = password.match(this.PWD_SPECIAL_CHAR_RE);
		return password.length >= this.PWD_MIN_LENGTH &&
			uc && uc.length >= this.PWD_UPPERCASE_MIN_COUNT &&
			lc && lc.length >= this.PWD_LOWERCASE_MIN_COUNT &&
			n && n.length >= this.PWD_NUMBER_MIN_COUNT &&
			sc && sc.length >= this.PWD_SPECIAL_MIN_COUNT;
	},

	generatePassword() {
		var password = "";
		var randomLength = Math.floor(Math.random() * (this.PWD_MAX_LENGTH - this.PWD_MIN_LENGTH)) + this.PWD_MIN_LENGTH;
		while (!this.isPasswordStrongEnough(password)) {
			password = passwordGenerator(randomLength, false, /[\w\d!#\$%\^&\*\.\?\-]/);
		}
		return password;
	},

	// Check password
	isPasswordValid(password) {
		// Check
		return /(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!#@:;,<>\/"'\$%\^&\*\.\?\-_\+\=\(\)])(?=.{8,})/.test(password);
	},

	// Hash password (old version kept for compatibility reason)
	hashPassword(password) {
		return crypto.createHash('sha256').update(password).digest('hex');
	},

	hashPasswordBcrypt(password) {
		return new Promise((fulfill, reject) => {
			// Generate a salt with 15 rounds
			bcrypt.genSalt(10, (err, salt) => {
				// Hash
				bcrypt.hash(password, salt, (err, hash) => {
					// Error?
					if(err) {
						reject(err);
					} else {
						fulfill(hash);
					}
				});
			});
		});
	},

	checkPasswordBCrypt(password, hash) {
		return new Promise((fulfill, reject) => {
			// Compare
			bcrypt.compare(password, hash, (err, match) => {
				// Error?
				if(err) {
					reject(err);
				} else {
					fulfill(match);
				}
			});
		});
	},

	// Check name
	isUserNameValid(name) {
		return /^[a-zA-Z\u00E0-\u00FC- ]*$/.test(name);
	},

	// Check email
	isUserEmailValid(email) {
		return /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/.test(email);
	},

	isTagIDValid(tagID) {
		return /^[A-Z0-9,]*$/.test(tagID);
	},

	isPhoneValid(phone) {
		return /^\+?([0-9] ?){9,14}[0-9]$/.test(phone);
	},

	isINumberValid(iNumber) {
		return /^[A-Z]{1}[0-9]{6}$/.test(iNumber);
	},

	checkIfUserValid(action, filteredRequest, req, res, next) {
		// Update mode?
		if(req.method === "PUT" && !filteredRequest.id) {
			Logging.logActionExceptionMessageAndSendResponse(action, new Error(`The user's ID is mandatory`), req, res, next);
			return false;
		}
		if(!filteredRequest.name) {
			Logging.logActionExceptionMessageAndSendResponse(action, new Error(`The user's last name is mandatory`), req, res, next);
			return false;
		}
		if(!filteredRequest.email) {
			Logging.logActionExceptionMessageAndSendResponse(action, new Error(`The user's email is mandatory`), req, res, next);
			return false;
		}
		if(!filteredRequest.status) {
			Logging.logActionExceptionMessageAndSendResponse(action, new Error(`The user's status is mandatory`), req, res, next);
			return false;
		}
		// Check password id provided
		if (filteredRequest.password && !this.isPasswordValid(filteredRequest.password)) {
			Logging.logActionExceptionMessageAndSendResponse(action, new Error(`The user's password is not valid`), req, res, next);
			return false;
		}
		// Check format
		if (!this.isUserNameValid(filteredRequest.name)) {
			Logging.logActionExceptionMessageAndSendResponse(action, new Error(`The user's last name ${filteredRequest.name} is not valid`), req, res, next);
			return false;
		}
		if (!this.isUserNameValid(filteredRequest.firstName)) {
			Logging.logActionExceptionMessageAndSendResponse(action, new Error(`The user's first name ${filteredRequest.firstName} is not valid`), req, res, next);
			return false;
		}
		if (!this.isUserEmailValid(filteredRequest.email)) {
			Logging.logActionExceptionMessageAndSendResponse(action, new Error(`The user's email ${filteredRequest.email} is not valid`), req, res, next);
			return false;
		}
		if (filteredRequest.phone && !this.isPhoneValid(filteredRequest.phone)) {
			Logging.logActionExceptionMessageAndSendResponse(action, new Error(`The user's phone ${filteredRequest.phone} is not valid`), req, res, next);
			return false;
		}
		if (filteredRequest.mobile && !this.isPhoneValid(filteredRequest.mobile)) {
			Logging.logActionExceptionMessageAndSendResponse(action, new Error(`The user's mobile ${filteredRequest.mobile} is not valid`), req, res, next);
			return false;
		}
		if (filteredRequest.iNumber && !this.isINumberValid(filteredRequest.iNumber)) {
			Logging.logActionExceptionMessageAndSendResponse(action, new Error(`The user's I-Number ${filteredRequest.iNumber} is not valid`), req, res, next);
			return false;
		}
		if (filteredRequest.tagIDs) {
			// Check
			if (!this.isTagIDValid(filteredRequest.tagIDs)) {
				Logging.logActionExceptionMessageAndSendResponse(action, new Error(`The user's tags ${filteredRequest.tagIDs} is/are not valid`), req, res, next);
				return false;
			}
			// Check
			if (!Array.isArray(filteredRequest.tagIDs)) {
				// Split
				filteredRequest.tagIDs = filteredRequest.tagIDs.split(',');
			}
		} else {
			// Default
			filteredRequest.tagIDs = [];
		}
		// Ok
		return true;
	},

	importUsers() {
		// Get from the file system
		var users = this.getUsers();
		// Found?
		if (users) {
			// Import them
			for (var i = 0; i < users.length; i++) {
				// Check & Save
				this._checkAndSaveUser(users[i]);
			}
			// Rename the file
			fs.renameSync(_userFilename, _userFilenameImported);
			// Imported
			Logging.logInfo({
				action: "ImportUser",
				module: "ChargingStationBackgroundTasks", method: "importUsers",
				message: `Users have been imported`,
				detailedMessages: users});
		}
	},

	// Read the user from file
	getUsers() {
		let users;
		// File exists?
		if(fs.existsSync(_userFilename)) {
			// Read in file
			users = fs.readFileSync(_userFilename, "UTF-8");
		}
		// Read conf
		return (users?JSON.parse(users):null);
	},

	_checkAndSaveUser(user) {
		// Get user
		global.storage.getUserByEmail(user.email).then((userDB) => {
			// Found
			if (!userDB) {
				global.storage.saveUser(user).then((newUser) => {
					console.log(`User Import: User with email '${user.email}' has been created with success`);
					Logging.logInfo({
						action: "ImportUser", module: "Users", method: "importUsers",
						message: `User ${Utils.buildUserFullName(newUser.getModel())} with email '${newUser.getEMail()}' has been imported successfully`,
						detailedMessages: user});
				}).catch((err) => {
					console.log(`User Import: Failed to import user with email '${user.email}': ${err.toString()}`);
					// Log
					Logging.logError({
						action: "ImportUser", module: "Users", method: "importUsers",
						message: `Cannot import user with email '${user.email}': ${err.toString()}`,
						detailedMessages: [user, err.stack] });
				});
			} else {
				console.log(`User Import: User with email '${user.email}' already exists`);
				Logging.logInfo({
					action: "ImportUser", module: "Users", method: "importUsers",
					message: `User with email '${user.email}' already exists`,
					detailedMessages: user});
			}
		});
	},

	getDefaultEulaEn() {
		return `
			<h1>End-user Agreement for the Usage of the Charge-Angels Monitoring Software at SAP Labs France</h1>
			<h2>Information</h2>
			<p>
				This chapter cannot be translated into english easily since CNIL is a French principle, the most important part is described in chapter 3 anyway.<br/>
				La loi « Informatique et Libertés » du 6 janvier 1978 modifiée par la loi du 6 août 2004 est applicable dès lors qu’il existe un traitement automatisé ou un fichier manuel (c’est-à-dire un fichier informatique ou un fichier « papier ») contenant des informations relatives à des personnes physiques.<br/>
				Elle définit les principes à respecter lors de la collecte, du traitement et de la conservation de ces données et garantit un certain nombre de droits pour les personnes.<br/>
				<br/>
				Read the official document : <a href="https://www.cnil.fr/sites/default/files/typo/document/Guide_employeurs_salaries.pdf">Guide</a>
			</p>

			<h2>How the CNIL applies to our EVSE monitoring application usecase</h2>

			<h3>General Principle</h3>
			<p>
			Personnal data can be stored only for the purpose of monitoring, optimizing electric vehicle chargers for SAP Labs France employees and visitors.
			</p>

			<h3>Keeping meaningfull data</h3>
			<p>
			Only meaningfull data will be stored regarding the usage of EVSE charging stations for each employee:
			</p>
			<ul>
				<li>First and Last Name</li>
				<li>Badge IDs</li>
				<li>The profil photo of SAP portal</li>
				<li>Plate ID of the Electric Vehicle</li>
				<li>Phone and Mobile numbers</li>
				<li>Email</li>
				<li>Professional ID Number</li>
				<li>Cost Center</li>
			</ul>
			<p>
			Charging information such as:
			</p>
			<ul>
				<li>Date, Hour, Duration</li>
				<li>Instant and Total Consumption</li>
				<li>Charging Stations and their Connector Statuses</li>
				<li>Consumption Curves</li>
				<li>User Sessions data</li>
				<li>Start/Stop on going Sessions</li>
				<li>Usage and Consumption Statistics</li>
				<li>Configuration</li>
				<li>Logging</li>
				<li>Price</li>
				<li>Site Management</li>
			</ul>

			<h3>keeping data duration</h3>
			<p>
			Personnal data above will be stored until the end of his/her contract.<br/>
			Personal data will be removed after that and sessions will be anonymized so no relation can be done with the user anymore.<br/>
			</p>

			<h3>Security and Non-disclosure principles</h3>
			<p>
			The duty of security and the prohibition of processing sensitive data is ensured:<br/>
			Credentials are required to access the dashboard for either administrators or standard users.<br/>
			Only administrators will be authorized to read, write, edit, delete all information.<br/>
			Standard users are only authorized to read their own information such as charging slot availability, charging status of others and charging booking calendar.<br/>
			Data can be communicated to third party people in case of legal aspects such as "Inspection du travail" or "Services fiscaux" or police services.<br/>
			</p>

			<h3>Personnal data individual liberties principles</h3>
			<h4>The duty to inform people of their rights</h4>
			<p>
			This document must be accepted by all users if they want to use available Charging Stations at the SAP Labs France premises.<br/>
			</p>
			<h4>The exercice of the right of access and correction</h4>
			<p>
			The holder of the right of access may require that the information concerning him/her that is inaccurate, incomplete, equivocal, no longer valid, or that the use, communication or keeping of which is prohibited, may be corrected, completed, clarified, updated or deleted.<br/>
			Every person, upon providing proof of his identity, has the right to make inquiry of the services responsible for implementation of automated processing of personnal information, in order to know whether this processing concerns his own personal information and, as applicable, to have it communicated to him/her.<br/>
			</p>
		`;
	}
};
