const mongoose = require('mongoose');
const commons = require('./MDBCommons');

module.exports = mongoose.model('Company',{
	name: String,
	address: commons.Address,
	logo: String,
	createdBy: String,
	createdOn: Date,
	lastChangedBy: String,
	lastChangedOn: Date
});
