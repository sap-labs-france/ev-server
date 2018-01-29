const mongoose = require('mongoose');
const commons = require('./MDBCommons');

module.exports = mongoose.model('User',{
	name: String,
	firstName: String,
	image: String,
	email: String,
	eulaAcceptedOn: Date,
	eulaAcceptedVersion: Number,
	eulaAcceptedHash: String,
	password: String,
	passwordWrongNbrTrials: Number,
	passwordBlockedUntil: Date,
	passwordResetHash: String,
	role: String,
	phone: String,
	mobile: String,
	iNumber: String,
	costCenter: String,
	status: String,
	address: commons.Address,
	locale: String,
	deleted: Boolean,
	createdBy: String,
	createdOn: Date,
	lastChangedBy: String,
	lastChangedOn: Date
});
