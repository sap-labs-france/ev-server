var mongoose = require('mongoose');

module.exports = mongoose.model('ElectricVehicule',{
  brand: String,
  plate: String,
  userID: {type: mongoose.Schema.ObjectId, ref: 'User'},
});
