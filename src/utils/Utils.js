var fs = require('fs');
var path = require('path');
var Users = require('./Users');

var _authorisation;

module.exports = {
  // Read the user from file
  getUsers() {
    // Read conf
    return JSON.parse(fs.readFileSync(path.join(__dirname, "../users.json"), "UTF-8"));
  },

  // Save the users in file
  saveUsers(users) {
    // Save
    fs.writeFileSync(path.join(__dirname, "../users-sav.json"), JSON.stringify(users, null, ' '), 'UTF-8');
  },

  getRandomInt() {
    return Math.floor((Math.random() * 1000000000) + 1);
  },

  buildEvseURL(request) {
    return request.headers.origin;
  }
};
