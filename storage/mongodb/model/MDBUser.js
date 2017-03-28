var mongoose = require('mongoose');

module.exports = mongoose.model('User',{
  name: String,
  tagID: String,
  email: String,
  phone: String,
  mobile: String,
  badgeNumber: Number,
  iNumber: String,
  costCenter: Number,
  location: String,
  status: String,
  createdBy: String,
  createdOn: Date,
  lastChangedBy: String,
  lastChangedOn: Date
});
