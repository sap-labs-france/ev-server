var crypto = require('crypto');
var passwordGenerator = require("password-generator");
var Logging = require('./Logging');

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
     return /(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!#\$%\^&\*\.\?\-])(?=.{8,})/.test(password);
   },

   // Hash password
   hashPassword(password) {
     return crypto.createHash('sha256').update(password).digest('hex');
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

   checkIfUserValid(req, res, next) {
     // Update mode?
     if(req.method === "PUT" && !req.body.id) {
       Logging.logActionErrorMessageAndSendResponse(`The user's ID is mandatory`, req, res, next);
       return false;
     }
     if(!req.body.name) {
       Logging.logActionErrorMessageAndSendResponse(`The user's last name is mandatory`, req, res, next);
       return false;
     }
     if(!req.body.email) {
       Logging.logActionErrorMessageAndSendResponse(`The user's email is mandatory`, req, res, next);
       return false;
     }
     if(!req.body.status) {
       Logging.logActionErrorMessageAndSendResponse(`The user's status is mandatory`, req, res, next);
       return false;
     }
     // Check password id provided
     if (req.body.password && !this.isPasswordValid(req.body.password)) {
       Logging.logActionErrorMessageAndSendResponse(`The user's password ${req.body.password} is not valid`, req, res, next);
       return false;
     }
     // Check format
     if (!this.isUserNameValid(req.body.name)) {
       Logging.logActionErrorMessageAndSendResponse(`The user's last name ${req.body.name} is not valid`, req, res, next);
       return false;
     }
     if (!this.isUserNameValid(req.body.firstName)) {
       Logging.logActionErrorMessageAndSendResponse(`The user's first name ${req.body.firstName} is not valid`, req, res, next);
       return false;
     }
     if (!this.isUserEmailValid(req.body.email)) {
       Logging.logActionErrorMessageAndSendResponse(`The user's email ${req.body.email} is not valid`, req, res, next);
       return false;
     }
     if (req.body.phone && !this.isPhoneValid(req.body.phone)) {
       Logging.logActionErrorMessageAndSendResponse(`The user's phone ${req.body.phone} is not valid`, req, res, next);
       return false;
     }
     if (req.body.mobile && !this.isPhoneValid(req.body.mobile)) {
       Logging.logActionErrorMessageAndSendResponse(`The user's mobile ${req.body.mobile} is not valid`, req, res, next);
       return false;
     }
     if (req.body.iNumber && !this.isINumberValid(req.body.iNumber)) {
       Logging.logActionErrorMessageAndSendResponse(`The user's I-Number ${req.body.iNumber} is not valid`, req, res, next);
       return false;
     }
     if (req.body.tagIDs) {
       // Check
       if (!this.isTagIDValid(req.body.tagIDs)) {
         Logging.logActionErrorMessageAndSendResponse(`The user's tags ${req.body.tagIDs} is/are not valid`, req, res, next);
         return false;
       }
       // Check
       if (!Array.isArray(req.body.tagIDs)) {
         // Split
         req.body.tagIDs = req.body.tagIDs.split(',');
       }
     } else {
       // Default
       req.body.tagIDs = [];
     }
     // Ok
     return true;
   }
};
