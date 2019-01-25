module.exports = {
  namespace: "eMobility",
  entityTypes: {
    "Transaction": {
      "id": { "type": "Edm.Int32", key: true },
      "chargeBoxID": { "type": "Edm.String" },
      "connectorId": { "type": "Edm.Int32" }
      // "timestamp": { "type": "Edm.DateTime"},
      // "stop": { 'type': 'eMobility.TransactionStop' }
    }
    // "BootNotification": {
    //   "id": { "type": "Edm.String", key: true },
    //   "chargePointVendor": { "type": "Edm.String" },
    //   "chargePointModel": { "type": "Edm.String" },
    //   "chargePointSerialNumber": { "type": "Edm.String" },
    //   "chargeBoxSerialNumber": { "type": "Edm.String" },
    //   "firmwareVersion": { "type": "Edm.String" },
    //   "ocppVersion": { "type": "Edm.String" },
    //   "endpoint": { "type": "Edm.String" },
    //   "timestamp":  { "type": "Edm.DateTime" },
    //   "chargeBoxID": { "type": "Edm.String" }
    // }
  },
  // complexTypes: {
  //   'TransactionStop': {
  //     "timestamp":  { "type": "Edm.DateTime" },
  //     "totalConsumption": { "type": "Edm.Int32" },
  //     "totalInactivitySecs": { "type": "Edm.Int32" },
  //     "totalDurationSecs": { "type": "Edm.Int32" },
  //     "stateOfCharge": { "type": "Edm.Int32" },
  //     "priceUnit": { "type": "Edm.String" },
  //     "price": { "type": "Edm.Double" }
  //   }
  // },
  entitySets: {
    "Transactions": {
      entityType: "eMobility.Transaction"
    }
    // ,
    // "BootNotifications": {
    //   entityType: "eMobility.BootNotification"
    // }
  }
};