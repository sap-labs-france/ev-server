const mongoose = require('mongoose');
const commons = require('./MDBCommons');

module.exports = mongoose.model('Site', {
	name: String,
	address: commons.Address,
	image: String,
	gps: String,
	createdBy: String,
	createdOn: Date,
	lastChangedBy: String,
	lastChangedOn: Date,
	companyID: {type: mongoose.Schema.Types.ObjectId, ref: 'Company'}
});
