const mongoose = require('mongoose');

module.exports = mongoose.model('Migration', {
  _id: String,
  timestamp: Date,
  name: String,
  version: String
});
