const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const passwordGenerator = require("password-generator");
const Logging = require('./Logging');
const bcrypt = require('bcrypt');
const eula = require('../end-user-agreement');
const Constants = require('./Constants');
const AppError = require('../exception/AppError');
const Mustache = require('mustache');
const Configuration = require('./Configuration');

require('source-map-support').install();

let _userFilename = path.join(__dirname, "../../users.json");
let _userFilenameImported = path.join(__dirname, "../../users-imported.json");
let _centralSystemFrontEndConfig = Configuration.getCentralSystemFrontEndConfig();

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

	getStatusDescription(status) {
		switch (status) {
			case this.USER_STATUS_PENDING:
				return "Pending";
			case this.USER_STATUS_LOCKED:
				return "Locked";
			case this.USER_STATUS_BLOCKED:
				return "Blocked";
			case this.USER_STATUS_ACTIVE:
				return "Active";
			case this.USER_STATUS_DELETED:
				return "Deleted";
			case this.USER_STATUS_INACTIVE:
				return "Inactive";
			default:
				return "Unknown";
		}
	},

	isPasswordStrongEnough(password) {
		let uc = password.match(this.PWD_UPPERCASE_RE);
		let lc = password.match(this.PWD_LOWERCASE_RE);
		let n = password.match(this.PWD_NUMBER_RE);
		let sc = password.match(this.PWD_SPECIAL_CHAR_RE);
		return password.length >= this.PWD_MIN_LENGTH &&
			uc && uc.length >= this.PWD_UPPERCASE_MIN_COUNT &&
			lc && lc.length >= this.PWD_LOWERCASE_MIN_COUNT &&
			n && n.length >= this.PWD_NUMBER_MIN_COUNT &&
			sc && sc.length >= this.PWD_SPECIAL_MIN_COUNT;
	},

	generatePassword() {
		let password = "";
		let randomLength = Math.floor(Math.random() * (this.PWD_MAX_LENGTH - this.PWD_MIN_LENGTH)) + this.PWD_MIN_LENGTH;
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
		let users = this.getUsers();
		// Found?
		if (users) {
			// Import them
			for (let i = 0; i < users.length; i++) {
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

	async _checkAndSaveUser(user) {
		try {
			// Get user
			let userDB = await global.storage.getUserByEmail(user.email);
			// Found
			if (!userDB) {
				let newUser = await global.storage.saveUser(user);
				console.log(`User Import: User with email '${user.email}' has been created with success`);
			} else {
				console.log(`User Import: User with email '${user.email}' already exists`);
			}
		} catch(err) {
			console.log(`User Import: Failed to import user with email '${user.email}': ${err.toString()}`);
		}
	},

	getEndUserLicenseAgreement(language="en") {
		// Get it
		let eulaText = eula[language];
		// Check
		if (!eulaText) {
			// Backup to EN
			eulaText = eula["en"];
		}
		// Build Front End URL
		let frontEndURL = _centralSystemFrontEndConfig.protocol + '://' +
			_centralSystemFrontEndConfig.host + ':' + _centralSystemFrontEndConfig.port; 
		// Parse the auth and replace values
		eulaText = Mustache.render(
			eulaText,
			{
				"chargeAngelsURL": frontEndURL
			}
		);
		// Parse
		return eulaText;
	}
};
