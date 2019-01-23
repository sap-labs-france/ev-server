const ODataTransactions = require('./odata-entities/ODataTransactions');
const oDataModel = require('./odata-model');


class ODataDatabaseAdapter {
  static query(collection, query, req, cb) {
    // get tenant TODO test
    req.user = {};
    req.user.tenantID = '5be7fb271014d90008992f06';

    switch (collection) {
      case 'Transactions':  
        ODataTransactions.query(query, req, cb);
        break;
      default:
        cb(null, 'test');
    }
    
  }

  // register adapter on ODataServer
  static registerAdapter(oDataServer) {
    if (!oDataServer) { return }
    // oDataServer.model(ODataDatabaseAdapter.getModel()).query(ODataDatabaseAdapter.query);
    oDataServer.model(oDataModel).query(ODataDatabaseAdapter.query);
  }
}


module.exports = ODataDatabaseAdapter;