const mongoose = require('mongoose');
const commons = require('./MDBCommons');

module.exports = mongoose.model('Site', {
	name: String,
	address: commons.Address,
	image: String,
	createdBy: {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
	createdOn: Date,
	lastChangedBy: {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
	lastChangedOn: Date,
	companyID: {type: mongoose.Schema.Types.ObjectId, ref: 'Company'}
});
