const mongoose = require('mongoose');
const commons = require('./MDBCommons');

module.exports = mongoose.model('User',{
	name: String,
	firstName: String,
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
	createdBy: {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
	createdOn: Date,
	lastChangedBy: {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
	lastChangedOn: Date
});
