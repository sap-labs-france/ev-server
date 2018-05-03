const mongoose = require('mongoose');

module.exports = mongoose.model('VehicleImage',{
	_id: {type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle'},
	images: [String]
});
