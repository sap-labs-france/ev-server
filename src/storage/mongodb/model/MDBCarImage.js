const mongoose = require('mongoose');

module.exports = mongoose.model('CarImage',{
	_id: {type: mongoose.Schema.Types.ObjectId, ref: 'Car'},
	images: [String]
});
