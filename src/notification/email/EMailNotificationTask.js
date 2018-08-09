const Configuration = require('../../utils/Configuration');
const Logging = require('../../utils/Logging');
const Utils = require('../../utils/Utils');
const email = require("emailjs");
const ejs = require('ejs');
const mainTemplate = require('./template/main-template.js');
const requestPassword = require('./template/request-password.js');
const chargingStationRegistered = require('./template/charging-station-registered.js');
const newPassword = require('./template/new-password.js');
const newRegisteredUser = require('./template/new-registered-user.js');
const userAccountStatusChanged = require('./template/user-account-status-changed.js');
const endOfCharge = require('./template/end-of-charge.js');
const endOfSession = require('./template/end-of-session.js');
const chargingStationStatusError = require('./template/charging-station-status-error.js');
const transactionStarted = require('./template/transaction-started');
const unknownUserBadged = require('./template/unknown-user-badged');
const NotificationTask = require('../NotificationTask');

require('source-map-support').install();

// Email
let _emailConfig = Configuration.getEmailConfig();

// https://nodemailer.com/smtp/
class EMailNotificationTask extends NotificationTask {
	constructor() {
		super();
		// Connect to the server
		this.server = email.server.connect({
			user: _emailConfig.smtp.user,
			password: _emailConfig.smtp.password,
			host: _emailConfig.smtp.host,
			port: _emailConfig.smtp.port,
			tls: _emailConfig.smtp.requireTLS,
			ssl: _emailConfig.smtp.secure
		});
	}

	sendNewRegisteredUser(data, locale) {
		// Create a promise
		return new Promise((fulfill, reject) => {
			// Send it
			this._prepareAndSendEmail('new-registered-user', data, locale, fulfill, reject);
		});
	}

	sendRequestPassword(data, locale) {
		// Create a promise
		return new Promise((fulfill, reject) => {
			// Send it
			this._prepareAndSendEmail('request-password', data, locale, fulfill, reject);
		});
	}

	sendNewPassword(data, locale) {
		// Create a promise
		return new Promise((fulfill, reject) => {
			// Send it
			this._prepareAndSendEmail('new-password', data, locale, fulfill, reject);
		});
	}

	sendEndOfCharge(data, locale) {
		// Create a promise
		return new Promise((fulfill, reject) => {
			// Send it
			this._prepareAndSendEmail('end-of-charge', data, locale, fulfill, reject);
		});
	}

	sendEndOfSession(data, locale) {
		// Create a promise
		return new Promise((fulfill, reject) => {
			// Send it
			this._prepareAndSendEmail('end-of-session', data, locale, fulfill, reject);
		});
	}

	sendChargingStationStatusError(data, locale) {
		// Create a promise
		return new Promise((fulfill, reject) => {
			// Send it
			this._prepareAndSendEmail('charging-station-status-error', data, locale, fulfill, reject);
		});
	}

	sendChargingStationRegistered(data, locale) {
		// Create a promise
		return new Promise((fulfill, reject) => {
			// Send it
			this._prepareAndSendEmail('charging-station-registered', data, locale, fulfill, reject);
		});
	}

	sendUserAccountStatusChanged(data, locale) {
		// Create a promise
		return new Promise((fulfill, reject) => {
			// Send it
			this._prepareAndSendEmail('user-account-status-changed', data, locale, fulfill, reject);
		});
	}

	sendUnknownUserBadged(data, locale) {
		// Create a promise
		return new Promise((fulfill, reject) => {
			// Send it
			this._prepareAndSendEmail('unknown-user-badged', data, locale, fulfill, reject);
		});
	}

	sendTransactionStarted(data, locale) {
		// Create a promise
		return new Promise((fulfill, reject) => {
			// Send it
			this._prepareAndSendEmail('transaction-started', data, locale, fulfill, reject);
		});
	}

	async _prepareAndSendEmail(templateName, data, locale, fulfill, reject) {
		// Create email
		let emailTemplate;

		// Get the template dir
		switch (templateName) {
			// Request password
			case 'request-password':
				// Copy
				emailTemplate = JSON.parse(JSON.stringify(requestPassword));
				break;
			// New password
			case 'new-password':
				emailTemplate = JSON.parse(JSON.stringify(newPassword));
				break;
			// Registered user
			case 'new-registered-user':
				emailTemplate = JSON.parse(JSON.stringify(newRegisteredUser));
				break;
			// End of charge
			case 'end-of-charge':
				emailTemplate = JSON.parse(JSON.stringify(endOfCharge));
				break;
			// End of session
			case 'end-of-session':
				emailTemplate = JSON.parse(JSON.stringify(endOfSession));
				break;
			// Charging Station Status Error
			case 'charging-station-status-error':
				emailTemplate = JSON.parse(JSON.stringify(chargingStationStatusError));
				break;
			case 'unknown-user-badged':
				emailTemplate = JSON.parse(JSON.stringify(unknownUserBadged));
				break;
			case 'transaction-started':
				emailTemplate = JSON.parse(JSON.stringify(transactionStarted));
				break;
			case 'user-account-status-changed':
				emailTemplate = JSON.parse(JSON.stringify(userAccountStatusChanged));
				break;
			case 'charging-station-registered':
				emailTemplate = JSON.parse(JSON.stringify(chargingStationRegistered));
				break;
		}
		// Template found?
		if (!emailTemplate) {
			// No
			reject(new Error(`No template found for ${templateName}`));
			return;
		}
		// Check for localized template?
		if (emailTemplate[locale]) {
			// Set the localized template
			emailTemplate = emailTemplate[locale];
		}

		// Render the localized template ---------------------------------------
		// Render the subject
		emailTemplate.email.subject = ejs.render(emailTemplate.email.subject, data);
		// Render Base URL
		emailTemplate.email.baseURL = ejs.render(emailTemplate.email.baseURL, data);
		// Render the title
		emailTemplate.email.body.header.title = ejs.render(emailTemplate.email.body.header.title, data);
		// Charge Angels Logo
		emailTemplate.email.body.header.image.left.url = ejs.render(emailTemplate.email.body.header.image.left.url, data);;
		// Company Logo
		emailTemplate.email.body.header.image.right.url = ejs.render(emailTemplate.email.body.header.image.right.url, data);
		// Render Lines Before Action
		emailTemplate.email.body.beforeActionLines =
			emailTemplate.email.body.beforeActionLines.map((beforeActionLine) => {
				return ejs.render(beforeActionLine, data);
			});
		// Remove extra empty lines
		Utils.removeExtraEmptyLines(emailTemplate.email.body.beforeActionLines);
		// Render Stats
		if (emailTemplate.email.body.stats) {
			emailTemplate.email.body.stats =
				emailTemplate.email.body.stats.map((stat) => {
					stat.label = ejs.render(stat.label, data);
					stat.value = ejs.render(stat.value, data);
					return stat;
				});
		}
		// Render Action
		if (emailTemplate.email.body.action) {
			emailTemplate.email.body.action.title =
				ejs.render(emailTemplate.email.body.action.title, data);
			emailTemplate.email.body.action.url =
				ejs.render(emailTemplate.email.body.action.url, data);
		}
		// Render Lines After Action
		emailTemplate.email.body.afterActionLines =
			emailTemplate.email.body.afterActionLines.map((afterActionLine) => {
				return ejs.render(afterActionLine, data);
			});
		// Remove extra empty lines
		Utils.removeExtraEmptyLines(emailTemplate.email.body.afterActionLines);
		// Render the final HTML -----------------------------------------------
		let subject = ejs.render(mainTemplate.subject, emailTemplate.email);
		let html = ejs.render(mainTemplate.html, emailTemplate.email);
		// Send the email
		let message = await this.sendEmail({
			to: (data.user?data.user.email:null),
			subject: subject,
			text: html,
			html: html
		});
		// User
		Logging.logInfo({
			module: "EMailNotificationTask", method: "_prepareAndSendEmail",
			action: "SendEmail", actionOnUser: data.user,
			message: `Email has been sent successfully`,
			detailedMessages: {
				"subject": subject,
				"body": html
			}
		});
		// Ok
		fulfill(message);
	}

	sendEmail(email) {
		// Add Admins in BCC
		if (_emailConfig.admins && _emailConfig.admins.length > 0) {
			// Add
			if (!email.bcc) {
				email.bcc = _emailConfig.admins.join(',');
			} else {
				email.bcc += ',' + _emailConfig.admins.join(',');
			}
		}
		// In promise
		return new Promise((fulfill, reject) => {
			// Create the message
			var message	= {
				from:  (!email.from?_emailConfig.from:email.from),
				to: email.to,
				cc: email.cc,
				bcc: email.bcc,
				subject: email.subject,
				// text: email.text,
				attachment: [
					{ data: email.html, alternative:true }
				]
			};

			// send the message and get a callback with an error or details of the message that was sent
			this.server.send(message, (err, message) => {
				// Error Handling
				if (err) {
					reject(err);
				} else {
					fulfill(message);
				}
			});
		});
	}
}

module.exports = EMailNotificationTask;
