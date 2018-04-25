const mongoose = require('mongoose');

module.exports = mongoose.model('VehicleManufacturerLogo',{
	_id: {type: mongoose.Schema.Types.ObjectId, ref: 'VehicleManufacturer'},
	logo: String
});
