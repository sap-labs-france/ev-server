const crypto = require('crypto');
const passwordGenerator = require('password-generator');
const bcrypt = require('bcrypt');
const Database = require('../utils/Database');
const Constants = require('../utils/Constants');
const AppError = require('../exception/AppError');
const Utils = require('../utils/Utils');
const UserStorage = require('../storage/mongodb/UserStorage');
const TransactionStorage = require('../storage/mongodb/TransactionStorage');
const Site = require('./Site');

class User {
	constructor(user) {
		// Init model
		this._model = {};

		// Set it
		Database.updateUser(user, this._model);
	}

	setAuthorisations(auths) {
		this._model.auths = auths;
	}

	setEulaAcceptedHash(eulaAcceptedHash) {
		this._model.eulaAcceptedHash = eulaAcceptedHash;
	}

	getEulaAcceptedHash() {
		return this._model.eulaAcceptedHash;
	}

	setEulaAcceptedVersion(eulaAcceptedVersion) {
		this._model.eulaAcceptedVersion = eulaAcceptedVersion;
	}

	getEulaAcceptedVersion() {
		return this._model.eulaAcceptedVersion;
	}

	setEulaAcceptedOn(eulaAcceptedOn) {
		this._model.eulaAcceptedOn = eulaAcceptedOn;
	}

	getEulaAcceptedOn() {
		return this._model.eulaAcceptedOn;
	}

	getModel() {
		return this._model;
	}

	getID() {
		return this._model.id;
	}

	getName() {
		return this._model.name;
	}

	setName(name) {
		this._model.name = name;
	}

	getPassword() {
		return this._model.password;
	}

	setPassword(password) {
		this._model.password = password;
	}

	getPasswordResetHash() {
		return this._model.passwordResetHash;
	}

	setPasswordResetHash(passwordResetHash) {
		this._model.passwordResetHash = passwordResetHash;
	}

	getPasswordWrongNbrTrials() {
		return this._model.passwordWrongNbrTrials;
	}

	setPasswordWrongNbrTrials(passwordWrongNbrTrials) {
		this._model.passwordWrongNbrTrials = passwordWrongNbrTrials;
	}

	getPasswordBlockedUntil() {
		return this._model.passwordBlockedUntil;
	}

	setPasswordBlockedUntil(passwordBlockedUntil) {
		this._model.passwordBlockedUntil = passwordBlockedUntil;
	}

	getLocale() {
		return (this._model.locale ? this._model.locale : Constants.DEFAULT_LOCALE);
	}

	getLanguage() {
		return this.getLocale().substring(0,2);
	}

	setLocale(locale) {
		this._model.locale = locale;
	}

	getRole() {
		return this._model.role;
	}

	setRole(role) {
		this._model.role = role;
	}

	getFirstName() {
		return this._model.firstName;
	}

	setFirstName(firstName) {
		this._model.firstName = firstName;
	}

	getFullName(withID=false) {
		return Utils.buildUserFullName(this.getModel(), withID)
	}

	getTagIDs() {
		return this._model.tagIDs;
	}

	setTagIDs(tagIDs) {
		this._model.tagIDs = tagIDs;
	}

	addTagID(tagID) {
		if (!this._model.tagIDs) {
			this._model.tagIDs = [];
		}
		this._model.tagIDs.push(tagID);
	}

	getImage() {
		return this._model.image;
	}

	setImage(image) {
		this._model.image = image;
	}

	getEMail() {
		return this._model.email;
	}

	setEMail(email) {
		this._model.email = email;
	}

	getPhone() {
		return this._model.phone;
	}

	setPhone(phone) {
		this._model.phone = phone;
	}

	getMobile() {
		return this._model.mobile;
	}

	setMobile(mobile) {
		this._model.mobile = mobile;
	}

	getINumber() {
		return this._model.iNumber;
	}

	setINumber(iNumber) {
		this._model.iNumber = iNumber;
	}

	getCostCenter() {
		return this._model.costCenter;
	}

	setCostCenter(costCenter) {
		this._model.costCenter = costCenter;
	}

	getStatus() {
		return this._model.status;
	}

	setStatus(status) {
		this._model.status = status;
	}

	getCreatedBy() {
		if (this._model.createdBy) {
			return new User(this._model.createdBy);
		}
		return null;
	}

	setCreatedBy(user) {
		this._model.createdBy = user.getModel();
	}

	getCreatedOn() {
		return this._model.createdOn;
	}

	setCreatedOn(createdOn) {
		this._model.createdOn = createdOn;
	}

	getAddress() {
		return this._model.address;
	}

	setAddress(address) {
		this._model.address = address;
	}

	getLastChangedBy() {
		if (this._model.lastChangedBy) {
			return new User(this._model.lastChangedBy);
		}
		return null;
	}

	setLastChangedBy(user) {
		this._model.lastChangedBy = user.getModel();
	}

	getLastChangedOn() {
		return this._model.lastChangedOn;
	}

	setLastChangedOn(lastChangedOn) {
		this._model.lastChangedOn = lastChangedOn;
	}

	setDeleted(deleted) {
		this._model.deleted = deleted;
	}

	isDeleted() {
		return this._model.deleted;
	}

	getVerificationToken() {
		return this._model.verificationToken;
	}

	setVerificationToken(verificationToken) {
		this._model.verificationToken = verificationToken;
	}

	getVerifiedAt() {
		return this._model.verifiedAt;
	}

	setVerifiedAt(verifiedAt) {
		this._model.verifiedAt = verifiedAt;
	}

	async getTransactions(filter) {
		if (!filter) {
			filter = {};
		}
		// Set the user ID
		filter.userId = this.getID();
		// Get the consumption
		let transactions = await TransactionStorage.getTransactions(filter, Constants.NO_LIMIT);
		// Return
		return transactions;
	}

	setSites(sites) {
		this._model.sites = sites.map((site) => site.getModel());
	}

	async getSites(withCompany=false, withSiteAreas=false,
			withChargeBoxes=false, withUsers=false) {
		// Get Sites
		let sites = await Site.getSites({'userID': this.getID(),
			withCompany, withSiteAreas, withChargeBoxes, withUsers});
		// Return the array
		return sites.result;
	}

	save() {
		return UserStorage.saveUser(this.getModel());
	}

	saveImage() {
		return UserStorage.saveUserImage(this.getModel());
	}

	async delete() {
		// Check if the user has a transaction
		let transactions = await this.getTransactions();
		// Check
		if (transactions.count > 0) {
			// Delete logically
			// Set deleted
			this.setDeleted(true);
			// Anonymize user
			this.setStatus(Constants.USER_STATUS_DELETED);
			this.setName(Constants.ANONIMIZED_VALUE);
			this.setFirstName(Constants.ANONIMIZED_VALUE);
			this.setAddress(null);
			this.setEMail(this.getID());
			this.setPassword(Constants.ANONIMIZED_VALUE);
			this.setPasswordResetHash(Constants.ANONIMIZED_VALUE);
			this.setPhone(Constants.ANONIMIZED_VALUE);
			this.setMobile(Constants.ANONIMIZED_VALUE);
			this.setINumber(Constants.ANONIMIZED_VALUE);
			this.setCostCenter(Constants.ANONIMIZED_VALUE);
			this.setImage(null);
			// Save User Image
			await this.saveImage();
			// Save User
			return this.save();
		} else {
			// Delete physically
			return UserStorage.deleteUser(this.getID());
		}
	}

	static checkIfUserValid(filteredRequest, request) {
		// Update model?
		if(request.method !== 'POST' && !filteredRequest.id) {
			throw new AppError(
				Constants.CENTRAL_SERVER,
				`The User ID is mandatory`, 500, 
				'Users', 'checkIfUserValid');
		}
		if(!filteredRequest.name) {
			throw new AppError(
				Constants.CENTRAL_SERVER,
				`The User Last Name is mandatory`, 500, 
				'Users', 'checkIfUserValid');
		}
		if(request.method === 'POST' && !filteredRequest.email) {
			throw new AppError(
				Constants.CENTRAL_SERVER,
				`The User Email is mandatory`, 500, 
				'Users', 'checkIfUserValid');
		}
		if (request.method === 'POST' && !User.isUserEmailValid(filteredRequest.email)) {
			throw new AppError(
				Constants.CENTRAL_SERVER,
				`The User Email ${filteredRequest.email} is not valid`, 500, 
				'Users', 'checkIfUserValid');
		}
		if (filteredRequest.password && !User.isPasswordValid(filteredRequest.password)) {
			throw new AppError(
				Constants.CENTRAL_SERVER,
				`The User Password is not valid`, 500, 
				'Users', 'checkIfUserValid');
		}
		if (filteredRequest.phone && !User.isPhoneValid(filteredRequest.phone)) {
			throw new AppError(
				Constants.CENTRAL_SERVER,
				`The User Phone ${filteredRequest.phone} is not valid`, 500, 
				'Users', 'checkIfUserValid');
		}
		if (filteredRequest.mobile && !User.isPhoneValid(filteredRequest.mobile)) {
			throw new AppError(
				Constants.CENTRAL_SERVER,
				`The User Mobile ${filteredRequest.mobile} is not valid`, 500, 
				'Users', 'checkIfUserValid');
		}
		if (filteredRequest.iNumber && !User.isINumberValid(filteredRequest.iNumber)) {
			throw new AppError(
				Constants.CENTRAL_SERVER,
				`The User I-Number ${filteredRequest.iNumber} is not valid`, 500, 
				'Users', 'checkIfUserValid');
		}
		if (filteredRequest.tagIDs) {
			// Check
			if (!User.isTagIDValid(filteredRequest.tagIDs)) {
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The User Tags ${filteredRequest.tagIDs} is/are not valid`, 500, 
					'Users', 'checkIfUserValid');
			}
			// Check
			if (!Array.isArray(filteredRequest.tagIDs)) {
				// Split
				filteredRequest.tagIDs = filteredRequest.tagIDs.split(',');
			}
		}
	}

	// Check email
	static isUserEmailValid(email) {
		return /^(([^<>()\[\]\\.,;:\s@']+(\.[^<>()\[\]\\.,;:\s@']+)*)|('.+'))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/.test(email);
	}

	static isTagIDValid(tagID) {
		return /^[A-Za-z0-9,]*$/.test(tagID);
	}

	static isPhoneValid(phone) {
		return /^\+?([0-9] ?){9,14}[0-9]$/.test(phone);
	}

	static isINumberValid(iNumber) {
		return /^[A-Z]{1}[0-9]{6}$/.test(iNumber);
	}

	static hashPasswordBcrypt(password) {
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
	}

	static checkPasswordBCrypt(password, hash) {
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
	}

	static getStatusDescription(status) {
		switch (status) {
			case Constants.USER_STATUS_PENDING:
				return 'Pending';
			case Constants.USER_STATUS_LOCKED:
				return 'Locked';
			case Constants.USER_STATUS_BLOCKED:
				return 'Blocked';
			case Constants.USER_STATUS_ACTIVE:
				return 'Active';
			case Constants.USER_STATUS_DELETED:
				return 'Deleted';
			case Constants.USER_STATUS_INACTIVE:
				return 'Inactive';
			default:
				return 'Unknown';
		}
	}

	static isPasswordStrongEnough(password) {
		let uc = password.match(Constants.PWD_UPPERCASE_RE);
		let lc = password.match(Constants.PWD_LOWERCASE_RE);
		let n = password.match(Constants.PWD_NUMBER_RE);
		let sc = password.match(Constants.PWD_SPECIAL_CHAR_RE);
		return password.length >= Constants.PWD_MIN_LENGTH &&
			uc && uc.length >= Constants.PWD_UPPERCASE_MIN_COUNT &&
			lc && lc.length >= Constants.PWD_LOWERCASE_MIN_COUNT &&
			n && n.length >= Constants.PWD_NUMBER_MIN_COUNT &&
			sc && sc.length >= Constants.PWD_SPECIAL_MIN_COUNT;
	}

	static generatePassword() {
		let password = '';
		let randomLength = Math.floor(Math.random() * (Constants.PWD_MAX_LENGTH - Constants.PWD_MIN_LENGTH)) + Constants.PWD_MIN_LENGTH;
		while (!User.isPasswordStrongEnough(password)) {
			password = passwordGenerator(randomLength, false, /[\w\d!#\$%\^&\*\.\?\-]/);
		}
		return password;
	}

	// Check password
	static isPasswordValid(password) {
		// Check
		return /(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!#@:;,<>\/''\$%\^&\*\.\?\-_\+\=\(\)])(?=.{8,})/.test(password);
	}

	// Hash password (old version kept for compatibility reason)
	static hashPassword(password) {
		return crypto.createHash('sha256').update(password).digest('hex');
	}

	static getUser(id) {
		return UserStorage.getUser(id);
	}

	static getUserByEmail(email) {
		return UserStorage.getUserByEmail(email);
	}

	static getUserByTagId(tagID) {
		return UserStorage.getUserByTagId(tagID);
	}

	static getUserImage(id) {
		return UserStorage.getUserImage(id);
	}

	static getUserImages(params, limit, skip, sort) {
		return UserStorage.getUserImages(params, limit, skip, sort)
	}

	static getUsers(params, limit, skip, sort) {
		return UserStorage.getUsers(params, limit, skip, sort)
	}

	static getEndUserLicenseAgreement(language) {
		return UserStorage.getEndUserLicenseAgreement(language);
	}

	static addSitesToUser(id, siteIDs) {
		return UserStorage.addSitesToUser(id, siteIDs);
	}

	static removeSitesFromUser(id, siteIDs) {
		return UserStorage.removeSitesFromUser(id, siteIDs);
	}
}

module.exports = User;
