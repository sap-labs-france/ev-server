const mongoose = require('mongoose');

module.exports = mongoose.model('Tag',{
  _id : String,
  userID: {type: mongoose.Schema.Types.ObjectId, ref: 'User'}
});
