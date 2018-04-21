const mongoose = require('mongoose');

module.exports = mongoose.model('CarLogo',{
	_id: {type: mongoose.Schema.Types.ObjectId, ref: 'Car'},
	logo: String
});
