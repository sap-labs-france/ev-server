module.exports = {
  namespace: "eMobility",
  entityTypes: {
    "Company": {
      "id": { "type": "Edm.String", key: true },
      "name":  { "type": "Edm.String" },
      "address": { 'type': 'eMobility.Address' }
    },
    "Site": {
      "id": { "type": "Edm.String", key: true },
      "name":  { "type": "Edm.String" },
      "companyID": { "type": "Edm.String" },
      "address": { 'type': 'eMobility.Address' }
    },
    "Transaction": {
      "id": { "type": "Edm.Int32", key: true },
      "chargeBoxID": { "type": "Edm.String" },
      "connectorId": { "type": "Edm.Int32" },
      "timestamp": { "type": "Edm.DateTimeOffset"},
      "tagID": { "type": "Edm.String" },
      "userID": { "type": "Edm.String" },
      "stop": { 'type': 'eMobility.TransactionStop' }
    },
    "BootNotification": {
      // "id": { "type": "Edm.String", key: true },
      "chargeBoxID": { "type": "Edm.String" , key: true},
      "chargePointVendor": { "type": "Edm.String" },
      "chargePointModel": { "type": "Edm.String" },
      "chargePointSerialNumber": { "type": "Edm.String" },
      "chargeBoxSerialNumber": { "type": "Edm.String" },
      "firmwareVersion": { "type": "Edm.String" },
      "ocppVersion": { "type": "Edm.String" },
      "endpoint": { "type": "Edm.String" },
      "timestamp":  { "type": "Edm.DateTimeOffset" }
    }
  },
  complexTypes: {
    'TransactionStop': {
      "timestamp":  { "type": "Edm.DateTimeOffset" },
      "totalConsumption": { "type": "Edm.Int32" },
      "totalInactivitySecs": { "type": "Edm.Int32" },
      "totalDurationSecs": { "type": "Edm.Int32" },
      "stateOfCharge": { "type": "Edm.Int32" },
      "priceUnit": { "type": "Edm.String" },
      "price": { "type": "Edm.Double" },
      "tagID": { "type": "Edm.String" },
      "userID": { "type": "Edm.String" }
    },
    'Address': {
      'country': { "type": "Edm.String" },
      'region': { "type": "Edm.String" },
      'department': { "type": "Edm.String" },
      'city': { "type": "Edm.String" },
      'postalCode': { "type": "Edm.String" },
      'address1': { "type": "Edm.String" },
      'address2': { "type": "Edm.String" },
      'latitude': { "type": "Edm.Double" },
      'longitude': { "type": "Edm.Double" }
    }
  },
  entitySets: {
    "Transactions": {
      entityType: "eMobility.Transaction"
    },
    "BootNotifications": {
      entityType: "eMobility.BootNotification"
    },
    "Companies": {
      entityType: "eMobility.Company"
    },
    "Sites": {
      entityType: "eMobility.Site"
    }
  }
};