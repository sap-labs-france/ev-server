var mongoose = require('mongoose');

module.exports = mongoose.model('User',{
  name: String,
  firstName: String,
  tagID: String,
  email: String,
  phone: String,
  mobile: String,
  badgeNumber: Number,
  iNumber: String,
  costCenter: Number,
  location: String,
  status: String,
  electricVehicules: []
});
