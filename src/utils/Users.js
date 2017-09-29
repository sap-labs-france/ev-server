const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const passwordGenerator = require("password-generator");
const Logging = require('./Logging');
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

  // Hash password (use secHashPassword, more secure)
  hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
  },

  // Generates random string of characters i.e salt
  secGenerateRandomString(length) {
    return crypto.randomBytes(Math.ceil(length/2))
      .toString('hex')  /** convert to hexadecimal format */
      .slice(0,length); /** return required number of characters */
  },

  // Hash password with sha512
  secHashPassword(password) {
    let salt = genRandomString(16);
    var hash = crypto.createHmac('sha512', salt); /** Hashing algorithm sha512 */
    hash.update(password);
    var value = hash.digest('hex');
    return {
      salt: salt,
      passwordHash: value
    };
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
      Logging.logActionErrorMessageAndSendResponse(action, `The user's ID is mandatory`, req, res, next);
      return false;
    }
    if(!filteredRequest.name) {
      Logging.logActionErrorMessageAndSendResponse(action, `The user's last name is mandatory`, req, res, next);
      return false;
    }
    if(!filteredRequest.email) {
      Logging.logActionErrorMessageAndSendResponse(action, `The user's email is mandatory`, req, res, next);
      return false;
    }
    if(!filteredRequest.status) {
      Logging.logActionErrorMessageAndSendResponse(action, `The user's status is mandatory`, req, res, next);
      return false;
    }
    // Check password id provided
    if (filteredRequest.password && !this.isPasswordValid(filteredRequest.password)) {
      Logging.logActionErrorMessageAndSendResponse(action, `The user's password is not valid`, req, res, next);
      return false;
    }
    // Check format
    if (!this.isUserNameValid(filteredRequest.name)) {
      Logging.logActionErrorMessageAndSendResponse(action, `The user's last name ${filteredRequest.name} is not valid`, req, res, next);
      return false;
    }
    if (!this.isUserNameValid(filteredRequest.firstName)) {
      Logging.logActionErrorMessageAndSendResponse(action, `The user's first name ${filteredRequest.firstName} is not valid`, req, res, next);
      return false;
    }
    if (!this.isUserEmailValid(filteredRequest.email)) {
      Logging.logActionErrorMessageAndSendResponse(action, `The user's email ${filteredRequest.email} is not valid`, req, res, next);
      return false;
    }
    if (filteredRequest.phone && !this.isPhoneValid(filteredRequest.phone)) {
      Logging.logActionErrorMessageAndSendResponse(action, `The user's phone ${filteredRequest.phone} is not valid`, req, res, next);
      return false;
    }
    if (filteredRequest.mobile && !this.isPhoneValid(filteredRequest.mobile)) {
      Logging.logActionErrorMessageAndSendResponse(action, `The user's mobile ${filteredRequest.mobile} is not valid`, req, res, next);
      return false;
    }
    if (filteredRequest.iNumber && !this.isINumberValid(filteredRequest.iNumber)) {
      Logging.logActionErrorMessageAndSendResponse(action, `The user's I-Number ${filteredRequest.iNumber} is not valid`, req, res, next);
      return false;
    }
    if (filteredRequest.tagIDs) {
      // Check
      if (!this.isTagIDValid(filteredRequest.tagIDs)) {
        Logging.logActionErrorMessageAndSendResponse(action, `The user's tags ${filteredRequest.tagIDs} is/are not valid`, req, res, next);
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
        userFullName: "System", source: "Central Server", action: "ImportUser",
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
            userFullName: "System", action: "ImportUser", source: "Central Server", module: "Users", method: "importUsers",
            message: `User ${newUser.getFullName()} with email '${newUser.getEMail()}' has been imported successfully`,
            detailedMessages: user});
        }).catch((err) => {
          console.log(`User Import: Failed to import user with email '${user.email}': ${err.toString()}`);
          // Log
          Logging.logError({
            userFullName: "System", action: "ImportUser", source: "Central Server", module: "Users", method: "importUsers",
            message: `Cannot import user with email '${user.email}': ${err.toString()}`,
            detailedMessages: [user, err.stack] });
        });
      } else {
        console.log(`User Import: User with email '${user.email}' already exists`);
        Logging.logInfo({
          userFullName: "System", action: "ImportUser", source: "Central Server", module: "Users", method: "importUsers",
          message: `User with email '${user.email}' already exists`,
          detailedMessages: user});
      }
    });
  }
};
