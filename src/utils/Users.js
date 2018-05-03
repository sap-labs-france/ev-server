const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const passwordGenerator = require("password-generator");
const Logging = require('./Logging');
const bcrypt = require('bcrypt');
const eula = require('../end-user-agreement');
const Constants = require('./Constants');
const AppError = require('../exception/AppError');

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

	WITH_ID: true,
	WITHOUT_ID: false,

	DEFAULT_LOCALE: "en_US",

	ANONIMIZED_VALUE: "####",

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

	checkIfUserValid(filteredRequest, request) {
		// Update model?
		if(request.method !== "POST" && !filteredRequest.id) {
			throw new AppError(
				Constants.CENTRAL_SERVER,
				`The User ID is mandatory`,
				500, "Users", "checkIfUserValid");
		}
		if(!filteredRequest.name) {
			throw new AppError(
				Constants.CENTRAL_SERVER,
				`The User Last Name is mandatory`,
				500, "Users", "checkIfUserValid");
		}
		if(!filteredRequest.email) {
			throw new AppError(
				Constants.CENTRAL_SERVER,
				`The User Email is mandatory`,
				500, "Users", "checkIfUserValid");
		}
		// Check password id provided
		if (filteredRequest.password && !this.isPasswordValid(filteredRequest.password)) {
			throw new AppError(
				Constants.CENTRAL_SERVER,
				`The User Password is not valid`,
				500, "Users", "checkIfUserValid");
		}
		// Check format
		if (!this.isUserNameValid(filteredRequest.name)) {
			throw new AppError(
				Constants.CENTRAL_SERVER,
				`The User Last Name ${filteredRequest.name} is not valid`,
				500, "Users", "checkIfUserValid");
		}
		if (!this.isUserNameValid(filteredRequest.firstName)) {
			throw new AppError(
				Constants.CENTRAL_SERVER,
				`The User First Name ${filteredRequest.firstName} is not valid`,
				500, "Users", "checkIfUserValid");
		}
		if (!this.isUserEmailValid(filteredRequest.email)) {
			throw new AppError(
				Constants.CENTRAL_SERVER,
				`The User Email ${filteredRequest.email} is not valid`,
				500, "Users", "checkIfUserValid");
		}
		if (filteredRequest.phone && !this.isPhoneValid(filteredRequest.phone)) {
			throw new AppError(
				Constants.CENTRAL_SERVER,
				`The User Phone ${filteredRequest.phone} is not valid`,
				500, "Users", "checkIfUserValid");
		}
		if (filteredRequest.mobile && !this.isPhoneValid(filteredRequest.mobile)) {
			throw new AppError(
				Constants.CENTRAL_SERVER,
				`The User Mobile ${filteredRequest.mobile} is not valid`,
				500, "Users", "checkIfUserValid");
		}
		if (filteredRequest.iNumber && !this.isINumberValid(filteredRequest.iNumber)) {
			throw new AppError(
				Constants.CENTRAL_SERVER,
				`The User I-Number ${filteredRequest.iNumber} is not valid`,
				500, "Users", "checkIfUserValid");
		}
		if (filteredRequest.tagIDs) {
			// Check
			if (!this.isTagIDValid(filteredRequest.tagIDs)) {
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The User Tags ${filteredRequest.tagIDs} is/are not valid`,
					500, "Users", "checkIfUserValid");
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
				}).catch((err) => {
					console.log(`User Import: Failed to import user with email '${user.email}': ${err.toString()}`);
				});
			} else {
				console.log(`User Import: User with email '${user.email}' already exists`);
			}
		});
	},

	getEndUserLicenseAgreement(language="en") {
		let eulaText = eula[language];

		if (!eulaText) {
			eulaText = eula["en"];
		}
		return eulaText;
	}
};
