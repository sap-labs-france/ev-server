
const ChargingStationStorage = require('../../../storage/mongodb/ChargingStationStorage');

class ODataBootNotifications {
  static async query(query, req, cb) {
    // Get Transactions
    const bootNotifications = await ChargingStationStorage.getBootNotifications(req.user.tenantID,
      {},
      query.$limit, query.$skip, query.$sort);

    // convert
    // const transactionsResult = bootNotifications.result.map((bootNot) => transaction.getModel());

    if (query.$inlinecount) {
      cb(null, {
        count: bootNotifications.result.length,
        value: bootNotifications.result
      });
    } else {
      cb(null, bootNotifications.result);
    }
  }
}


module.exports = ODataBootNotifications;