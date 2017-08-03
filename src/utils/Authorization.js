const fs = require('fs');
const path = require('path');
const _authorisation = require('../authorisation.json');

module.exports = {
  getAuthorizations() {
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
