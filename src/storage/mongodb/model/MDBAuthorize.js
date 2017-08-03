const mongoose = require('mongoose');

module.exports = mongoose.model('Authorize',{
  _id: String,
  chargeBoxID: {type: String, ref: 'ChargingStation'},
  tagID: {type: String, ref: 'Tag'},
  userID: {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
  timestamp: Date
});
