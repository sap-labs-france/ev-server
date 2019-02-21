module.exports = {
  namespace: "eMobility",
  entityTypes: {
    "Company": {
      "tenant": { "type": "Edm.String"},
      "id": { "type": "Edm.String", key: true },
      "name":  { "type": "Edm.String" },
      'country': { "type": "Edm.String" },
      'region': { "type": "Edm.String" },
      'department': { "type": "Edm.String" },
      'city': { "type": "Edm.String" },
      'postalCode': { "type": "Edm.String" },
      'address1': { "type": "Edm.String" },
      'address2': { "type": "Edm.String" },
      'latitude': { "type": "Edm.Double" },
      'longitude': { "type": "Edm.Double" }
    },
    "Site": {
      "tenant": { "type": "Edm.String"},
      "id": { "type": "Edm.String", key: true },
      "name":  { "type": "Edm.String" },
      "companyID": { "type": "Edm.String" },
      'country': { "type": "Edm.String" },
      'region': { "type": "Edm.String" },
      'department': { "type": "Edm.String" },
      'city': { "type": "Edm.String" },
      'postalCode': { "type": "Edm.String" },
      'address1': { "type": "Edm.String" },
      'address2': { "type": "Edm.String" },
      'latitude': { "type": "Edm.Double" },
      'longitude': { "type": "Edm.Double" }
    },
    "SiteArea": {
      "tenant": { "type": "Edm.String"},
      "id": { "type": "Edm.String", key: true },
      "name":  { "type": "Edm.String" },
      "siteID": { "type": "Edm.String" },
      'country': { "type": "Edm.String" },
      'region': { "type": "Edm.String" },
      'department': { "type": "Edm.String" },
      'city': { "type": "Edm.String" },
      'postalCode': { "type": "Edm.String" },
      'address1': { "type": "Edm.String" },
      'address2': { "type": "Edm.String" },
      'latitude': { "type": "Edm.Double" },
      'longitude': { "type": "Edm.Double" }
    },
    "ChargingStation": {
      "tenant": { "type": "Edm.String"},
      "id": { "type": "Edm.String", key: true },
      "chargeBoxSerialNumber" : { "type": "Edm.String" },
      "chargePointModel" : { "type": "Edm.String" },
      "chargePointSerialNumber" : { "type": "Edm.String" },
      "chargePointVendor" : { "type": "Edm.String" },
      "firmwareVersion" : { "type": "Edm.String" },
      "ocppVersion" : { "type": "Edm.String" },
      "deleted" : { "type": "Edm.Boolean" },
      "maximumPower" : { "type": "Edm.Int64" },
      "numberOfConnectedPhase" : { "type": "Edm.Int64" },
      "cannotChargeInParallel" :  { "type": "Edm.Boolean" },
      "siteAreaID": { "type": "Edm.String" },
      "latitude": { "type": "Edm.Double" },
      "longitude": { "type": "Edm.Double" }
    },
    "User": {
      "tenant": { "type": "Edm.String"},
      "id" : { "type": "Edm.String" , key: true},
      "email" : { "type": "Edm.String" },
      "name" : { "type": "Edm.String" },
      "firstName" : { "type": "Edm.String" },
      "phone" : { "type": "Edm.String" },
      "mobile" : { "type": "Edm.String" },
      "iNumber" : { "type": "Edm.String" },
      "costCenter" : { "type": "Edm.String" },
      "status" : { "type": "Edm.String" },
      "role" : { "type": "Edm.String" },
      "deleted" : { "type": "Edm.Boolean" },
      "address" : { 'type': 'eMobility.Address' }
    },
    "Transaction": {
      "tenant": { "type": "Edm.String" },
      "id": { "type": "Edm.Int32" , key: true},
      "chargeBoxID": { "type": "Edm.String" },
      "connectorId": { "type": "Edm.Int32" },
      "timestamp": { "type": "Edm.DateTimeOffset"},
      "startDate": { "type": "eMobility.ComplexDate"},
      "stopDate": { "type": "eMobility.ComplexDate"},
      "startTagID": { "type": "Edm.String" },
      "stopTagID": { "type": "Edm.String" },
      "startUser": { "type": "eMobility.User" },
      "stopUser": { "type": "eMobility.User" },
      "stop": { "type": "eMobility.TransactionStop" }
    },
    "BootNotification": {
      "tenant": { "type": "Edm.String"},
      "chargeBoxID": { "type": "Edm.String" , key: true},
      "chargePointVendor": { "type": "Edm.String" },
      "chargePointModel": { "type": "Edm.String" },
      "chargePointSerialNumber": { "type": "Edm.String" },
      "chargeBoxSerialNumber": { "type": "Edm.String" },
      "firmwareVersion": { "type": "Edm.String" },
      "ocppVersion": { "type": "Edm.String" },
      "endpoint": { "type": "Edm.String" },
      "timestamp":  { "type": "Edm.DateTimeOffset" }
    },
    "StatusNotification": {
      "tenant": { "type": "Edm.String" },
      "id": { "type": "Edm.Int32" , key: true},
      "chargeBoxID": { "type": "Edm.String" },
      "connectorId": { "type": "Edm.Int32" },
      "timestamp": { "type": "Edm.DateTimeOffset"},
      "status": { "type": "Edm.String" },
      "errorCode": { "type": "Edm.String" },
      "info": { "type": "Edm.String" },
      "vendorId": { "type": "Edm.String" },
      "vendorErrorCode":{ "type": "Edm.String" }
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
      "price": { "type": "Edm.Double" }
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
    },
    'User': {
      "id" : { "type": "Edm.String"},
      "fullName" : { "type": "Edm.String" }
    },
    'ComplexDate': {
      "date" : { "type": "Edm.DateTimeOffset"},
      "dayOfTheWeek" : { "type": "Edm.Int32"},
      "hourOfTheDay" : { "type": "Edm.Int32"},
      "weekOfTheYear" : { "type": "Edm.Int32"}
    }
  },
  entitySets: {
    "Transactions": {
      entityType: "eMobility.Transaction"
    },    
    "TransactionsCompleted": {
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
    },
    "SiteAreas": {
      entityType: "eMobility.SiteArea"
    },
    "ChargingStations": {
      entityType: "eMobility.ChargingStation"
    },
    "Users": {
      entityType: "eMobility.User"
    },
    "StatusNotifications": {
      entityType: "eMobility.StatusNotification"
    }
  }
};