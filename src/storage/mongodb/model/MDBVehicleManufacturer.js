const mongoose = require('mongoose');

module.exports = mongoose.model('VehicleManufacturer', {
	name: String,
	createdBy: {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
	createdOn: Date,
	lastChangedBy: {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
	lastChangedOn: Date
});
