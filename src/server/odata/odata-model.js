module.exports = {
  namespace: "eMobility",
  entityTypes: {
    "Transaction": {
      "id": { "type": "Edm.Int32", key: true },
      "chargeBoxID": { "type": "Edm.String" },
      "connectorId": { "type": "Edm.Int32" },
      "timestamp": { "type": "Edm.DateTime"}
    },
    "BootNotification": {
      "id": { "type": "Edm.String", key: true },
      "chargePointVendor": { "type": "Edm.String" },
      "chargePointModel": { "type": "Edm.String" },
      "chargePointSerialNumber": { "type": "Edm.String" },
      "chargeBoxSerialNumber": { "type": "Edm.String" },
      "firmwareVersion": { "type": "Edm.String" },
      "ocppVersion": { "type": "Edm.String" },
      "endpoint": { "type": "Edm.String" },
      "timestamp":  { "type": "Edm.DateTime" },
      "chargeBoxID": { "type": "Edm.String" }
    }
  },
  entitySets: {
    "Transactions": {
      entityType: "eMobility.Transaction"
    },
    "BootNotifications": {
      entityType: "eMobility.BootNotification"
    }
  }
};