const mongoose = require('mongoose');
const commons = require('./MDBCommons');

module.exports = mongoose.model('UserImage',{
	_id: {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
	image: String
});
