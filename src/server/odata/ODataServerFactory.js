const ODataServer = require('simple-odata-server');
const ODataDatabaseAdapter = require('./ODataDatabaseAdapter');
require('source-map-support').install();

class ODataServerFactory {
  constructor() {
    this.odataserver = ODataServer();
    ODataDatabaseAdapter.registerAdapter(this.odataserver);
  }

  getODataServer() {
    return this.odataserver;
  }
}

module.exports = ODataServerFactory;