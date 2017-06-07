var fs = require('fs');
var path = require('path');

var _authorisation;

module.exports = {
  // Read the config file
  getAuthorizations() {
    // Read conf
    if (!_authorisation) {
      _authorisation = JSON.parse(fs.readFileSync(path.join(__dirname,"../authorisation.json"), "UTF-8"));
    }
    return _authorisation;
  },

  // Read the config file
  getAuthorizationFromRoleID(roleID) {
    // Filter
    let matchingAuthorisation = this.getAuthorizations().filter((authorisation) => {
      return authorisation.id === roleID;
    });
    // Only one role
    return (matchingAuthorisation.length > 0 ? matchingAuthorisation[0] : []);
  }
};
