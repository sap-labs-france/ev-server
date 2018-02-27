const mongoose = require('mongoose');
const commons = require('./MDBCommons');

module.exports = mongoose.model('Company',{
	name: String,
	address: commons.Address,
	logo: String,
	users: [
		{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }
	],
	createdBy: {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
	createdOn: Date,
	lastChangedBy: {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
	lastChangedOn: Date
});
