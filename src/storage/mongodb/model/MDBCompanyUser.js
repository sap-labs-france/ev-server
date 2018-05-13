const mongoose = require('mongoose');

module.exports = mongoose.model('CompanyUser',{
	companyID: {type: mongoose.Schema.Types.ObjectId, ref: 'Company'},
	userID: {type: mongoose.Schema.Types.ObjectId, ref: 'User'}
});
