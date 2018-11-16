const moment = require('moment');
const {expect} = require('chai');
const chai = require('chai');
const chaiSubset = require('chai-subset');
const Transaction = require('../../src/entity/Transaction');
const Database = require('../../src/utils/Database');
chai.use(chaiSubset);

const Factory = require('rosie').Factory;
const faker = require('faker');
const ObjectId = require("mongodb").ObjectId;

const UserFactory = Factory.define('user')
  .attr('id', () => faker.random.number(100000))
  .attr('firstName', () => faker.name.firstName())
  .attr('name', () => faker.name.lastName());

const TransactionFactory = Factory.define('transaction')
  .attr('id', () => faker.random.number(100000))
  .attr('chargeBoxID', () => faker.random.alphaNumeric(10))
  .attr('connectorId', () => faker.random.number({min: 0, max: 5}))
  .attr('timestamp', () => new Date())
  .attr('tagID', () => faker.random.alphaNumeric(10))
  .attr('user', () => UserFactory.build())
  .attr('meterValues', ['meterValues', 'id', 'connectorId', 'timestamp'], function(meterValues, id, connectorId, timestamp) {
    if (!meterValues) {
      meterValues = [{}, {}];
    }
    return meterValues.map(() => {
      return Factory.attributes('meterValue', {
        transactionId: id,
        connectorId: connectorId,
        timestamp: timestamp,
      });
    });
  });

const EmptyTransactionFactory = Factory.define('empty-transaction').extend('transaction').attr('meterValues', undefined);

const MeterValueFactory = Factory.define('meterValue')
  .attr('id', () => faker.random.number(100000))
  .attr('connectorId', () => faker.random.number({min: 0, max: 5}))
  .attr('value', 0)
  .attr('attribute', {
    unit: 'Wh',
    location: 'Outlet',
    measurand: faker.random.alphaNumeric(10),
    format: 'Raw',
    context: 'Sample.Periodic'
  })
  .attr('timestamp', new Date());

describe('Transaction DB Update test', () => {
  it('closed transaction db to entity ', () => {
    const fromDB = {
      "_id": 112940,
      "chargeBoxID": "SAP-Mougins-06",
      "connectorId": 2,
      "meterStart": 0,
      "tagID": "7099C291",
      "timestamp": "2018-08-03T14:24:02.000Z",
      "userID": ObjectId("592e969f89d8e07a2b16a7b2"),
      "stop": {
        "userID": ObjectId("592e969f89d8e07a2b16a7b2"),
        "timestamp": "2018-08-03T17:47:49.000Z",
        "tagID": "7099C291",
        "meterStop": 4996,
        "transactionData": null,
        "totalConsumption": 4996,
        "totalDurationSecs": 8000,
        "totalInactivitySecs": 7980
      },
      pricing: {
        "_id": "59c9fb0e13d0d840b83b74f2",
        "__v": 0,
        "timestamp": "2018-08-03T15:26:14.310Z",
        "priceKWH": 0.1243,
        "priceUnit": "EUR"
      }
    };
    const model = {};
    Database.updateTransactionForFrontEnd(fromDB, model);
    expect(model).to.deep.equal({
      "chargeBoxID": "SAP-Mougins-06",
      "connectorId": 2,
      "id": 112940,
      "meterStart": 0,
      "meterStop": 4996,
      "stop": {
        "tagID": "7099C291",
        "timestamp": new Date('2018-08-03T17:47:49.000Z'),
        "userID": "592e969f89d8e07a2b16a7b2",
      },
      "tagID": "7099C291",
      "timestamp": new Date('2018-08-03T14:24:02.000Z'),
      "totalConsumption": 4996,
      "totalInactivitySecs": 7980,
      "totalDurationSecs": 8000,
      "transactionData": null,
      "userID": "592e969f89d8e07a2b16a7b2",
    });
    const transaction = new Transaction(model);
    expect(transaction.model).to.deep.equal({
      "chargeBoxID": "SAP-Mougins-06",
      "connectorId": 2,
      "id": 112940,
      "meterStart": 0,
      "meterStop": 4996,
      "stop": {
        "tagID": "7099C291",
        "timestamp": new Date('2018-08-03T17:47:49.000Z'),
        "userID": "592e969f89d8e07a2b16a7b2",
      },
      "tagID": "7099C291",
      "timestamp": new Date('2018-08-03T14:24:02.000Z'),
      "totalConsumption": 4996,
      "totalInactivitySecs": 7980,
      "totalDurationSecs" : 8000,
      "transactionData": null,
      "userID": "592e969f89d8e07a2b16a7b2",
    });
  });

  it('closed transaction with meter values to entity ', () => {
    const fromDB = {
      "_id": 112940,
      "chargeBoxID": "SAP-Mougins-06",
      "connectorId": 2,
      "meterStart": 0,
      "tagID": "7099C291",
      "timestamp": "2018-08-03T14:24:02.000Z",
      "userID": ObjectId("592e969f89d8e07a2b16a7b2"),
      /* 1 */
      user: {
        "_id": ObjectId("592e969f89d8e07a2b16a7b2"),
        "email": "a.zid@sap.com",
        "name": "aName",
        "firstName": "aFirsName",
      },
      "stop": {
        "userID": ObjectId("592e969f89d8e07a2b16a7b2"),
        user: {
          "_id": ObjectId("592e969f89d8e07a2b16a7b2"),
          "email": "a.zid@sap.com",
          "name": "aName",
          "firstName": "aFirsName",
        },
        "timestamp": "2018-08-03T17:47:49.000Z",
        "tagID": "7099C291",
        "meterStop": 4996,
        "transactionData": null,
        "totalConsumption": 4996,
        "totalInactivitySecs": 7980
      },
      meterValues: [
        /* 1 */
        {
          "_id": "8975ee06fa169772302bc0038cc4cb0232332b4c8355a5e4407a1f72cf56f2ce",
          "chargeBoxID": "SAP-Mougins-06",
          "connectorId": 2,
          "transactionId": 112940,
          "timestamp": "2018-08-03T14:25:02.000Z",
          "value": 76,
          "attribute": {
            "unit": "Wh",
            "location": "Outlet",
            "measurand": "Energy.Active.Import.Register",
            "format": "Raw",
            "context": "Sample.Periodic"
          }
        },

        /* 2 */
        {
          "_id": "96bf01c72e4e6a10c844e31669a3bb9b3001eff5646a41c3432b8aa38a53301a",
          "chargeBoxID": "SAP-Mougins-06",
          "connectorId": 2,
          "transactionId": 112940,
          "timestamp": "2018-08-03T14:26:02.000Z",
          "value": 165,
          "attribute": {
            "unit": "Wh",
            "location": "Outlet",
            "measurand": "Energy.Active.Import.Register",
            "format": "Raw",
            "context": "Sample.Periodic"
          }
        },

        /* 3 */
        {
          "_id": "06260f4b855834d6cc99e5e5616678120060c288742a3f5d6ff659bcb2f3010b",
          "chargeBoxID": "SAP-Mougins-06",
          "connectorId": 2,
          "transactionId": 112940,
          "timestamp": "2018-08-03T14:27:02.000Z",
          "value": 252,
          "attribute": {
            "unit": "Wh",
            "location": "Outlet",
            "measurand": "Energy.Active.Import.Register",
            "format": "Raw",
            "context": "Sample.Periodic"
          }
        },

        /* 4 */
        {
          "_id": "97d79c9048665b4a9a1eba8e09f7219637a035cdc5d6d2dde5b9718c258f6816",
          "chargeBoxID": "SAP-Mougins-06",
          "connectorId": 2,
          "transactionId": 112940,
          "timestamp": "2018-08-03T14:28:02.000Z",
          "value": 339,
          "attribute": {
            "unit": "Wh",
            "location": "Outlet",
            "measurand": "Energy.Active.Import.Register",
            "format": "Raw",
            "context": "Sample.Periodic"
          }
        },

        /* 5 */
        {
          "_id": "f2909922e21705ddf2397c977837601c399f8fc121d565fc5aaba097eb5ef41f",
          "chargeBoxID": "SAP-Mougins-06",
          "connectorId": 2,
          "transactionId": 112940,
          "timestamp": "2018-08-03T14:29:02.000Z",
          "value": 426,
          "attribute": {
            "unit": "Wh",
            "location": "Outlet",
            "measurand": "Energy.Active.Import.Register",
            "format": "Raw",
            "context": "Sample.Periodic"
          }
        }

      ]
    };
    const model = {};
    Database.updateTransactionForFrontEnd(fromDB, model);
    model.pricing = {
      "_id": "59c9fb0e13d0d840b83b74f2",
      "__v": 0,
      "timestamp": "2018-08-03T15:26:14.310Z",
      "priceKWH": 0.1243,
      "priceUnit": "EUR"
    };
    const stop = model.stop;
    delete model.stop;
    const transaction = new Transaction(model);
    transaction.stop(stop.user, stop.tagID, transaction.meterStop, stop.timestamp);
    expect(transaction.model).to.deep.equal({
      "chargeBoxID": "SAP-Mougins-06",
      "connectorId": 2,
      "id": 112940,
      "meterStart": 0,
      "meterStop": 4996,
      "price": 0.6210028,
      "priceUnit": "EUR",
      "stop": {
        "tagID": "7099C291",
        "timestamp": new Date('2018-08-03T17:47:49.000Z'),
        "userID": "592e969f89d8e07a2b16a7b2",
        "user": {
          "deleted": undefined,
          "verificationToken": undefined,
          "address": {},
          "email": "a.zid@sap.com",
          "firstName": "aFirsName",
          "id": "592e969f89d8e07a2b16a7b2",
          "name": "aName",
        }
      },
      "tagID": "7099C291",
      "timestamp": new Date('2018-08-03T14:24:02.000Z'),
      "totalConsumption": 4996,
      "totalDurationSecs": 12227,
      "totalInactivitySecs": 0,
      "transactionData": null,
      "userID": "592e969f89d8e07a2b16a7b2",
      "user": {
        "deleted": undefined,
        "verificationToken": undefined,
        "address": {},
        "email": "a.zid@sap.com",
        "firstName": "aFirsName",
        "id": "592e969f89d8e07a2b16a7b2",
        "name": "aName",
      }
    });
    const toDB = {};
    Database.updateTransactionForDB(transaction.model, toDB);
    expect(toDB).to.deep.equal({
      "id": 112940,
      "chargeBoxID": "SAP-Mougins-06",
      "connectorId": 2,
      "meterStart": 0,
      "tagID": "7099C291",
      "timestamp": new Date("2018-08-03T14:24:02.000Z"),
      "userID": ObjectId("592e969f89d8e07a2b16a7b2"),
      "stop": {
        "userID": ObjectId("592e969f89d8e07a2b16a7b2"),
        "timestamp": new Date("2018-08-03T17:47:49.000Z"),
        "tagID": "7099C291",
        "meterStop": 4996,
        "transactionData": null,
        "totalConsumption": 4996,
        "totalDurationSecs": 12227,
        "totalInactivitySecs": 0
      }
    });
  });

})
;