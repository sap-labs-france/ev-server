const mongoose = require('mongoose');

module.exports = mongoose.model('UserImage',{
	_id: {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
	image: String
});
