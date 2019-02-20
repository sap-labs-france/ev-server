const ODataServer = require('simple-odata-server');
const ODataRestAdapter = require('./ODataRestAdapter');
require('source-map-support').install();

class ODataServerFactory {
  constructor() {
    this.odataserver = ODataServer();
    ODataRestAdapter.registerAdapter(this.odataserver);
  }

  getODataServer() {
    return this.odataserver;
  }
}

module.exports = ODataServerFactory;