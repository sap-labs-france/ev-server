const mongoose = require('mongoose');
const commons = require('./MDBCommons');

module.exports = mongoose.model('Company',{
	name: String,
	logo: String,
	address: commons.Address,
	createdBy: String,
	createdOn: Date,
	lastChangedBy: String,
	lastChangedOn: Date
});
