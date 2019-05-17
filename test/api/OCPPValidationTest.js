const path = require('path');
global.appRoot = path.resolve(__dirname, '../../src');
const chai = require('chai');
const {expect} = require('chai');
chai.use(require('chai-subset'));
chai.use(require('chai-datetime'));
const moment = require('moment');
const faker = require('faker');
const DataHelper = require('./DataHelper');
const CentralServerService = require('../api/client/CentralServerService');
const Factory = require('../factories/Factory');

describe('OCPP Validation tests', function() {
  this.timeout(10000);
  before(async () => {
    this.tenantID = await CentralServerService.authenticatedApi.getTenantID();
    this.dataHelper = new DataHelper('1.6', this.tenantID);
    this.dataHelper15 = new DataHelper('1.5', this.tenantID);

    this.validTag = faker.random.alphaNumeric(20).toString();
    this.invalidTag = faker.random.alphaNumeric(21).toString();
    this.numberTag = faker.random.number(10000);
    this.defaultUser = await this.dataHelper.createUser(Factory.user.build({tagIDs: [this.validTag, this.invalidTag, this.numberTag.toString()]}));

    this.defaultCompany = await this.dataHelper.createCompany();
    this.defaultSite = await this.dataHelper.createSite(this.defaultCompany, [this.defaultUser]);

    this.defaultConnectorId = 1;
    this.defaultMeterStart = 0;
    this.defaultChargingStation = await this.dataHelper.createChargingStation();
    await this.dataHelper.createSiteArea(this.defaultSite, [this.defaultChargingStation]);

    this.defaultChargingStation15 = await this.dataHelper15.createChargingStation();
    await this.dataHelper15.createSiteArea(this.defaultSite, [this.defaultChargingStation15]);
  });

  after(async () => {
    this.dataHelper.close();
    this.dataHelper.destroyData();

    this.dataHelper15.close();
    this.dataHelper15.destroyData();
  });

  it('Should be possible to authorize a user with tag as integer', async () => {
    await this.dataHelper.authorize(this.defaultChargingStation, this.numberTag);
    await this.dataHelper.authorize(this.defaultChargingStation, this.numberTag.toString());

    await this.dataHelper15.authorize(this.defaultChargingStation, this.numberTag);
    await this.dataHelper15.authorize(this.defaultChargingStation, this.numberTag.toString());
  });

  it('Should not be possible to authorize a user with a invalid tags', async () => {
    await this.dataHelper.authorize(this.defaultChargingStation, this.invalidTag, "Invalid");
    await this.dataHelper.authorize(this.defaultChargingStation, '', "Invalid");
    await this.dataHelper.authorize(this.defaultChargingStation, undefined, "Invalid");

    await this.dataHelper15.authorize(this.defaultChargingStation15, this.invalidTag, "Invalid");
    await this.dataHelper15.authorize(this.defaultChargingStation15, '', "Invalid");
    await this.dataHelper15.authorize(this.defaultChargingStation15, undefined, "Invalid");
  });

  it('Should be possible to start a transaction with tag as integer', async () => {
    await this.dataHelper.startTransaction(this.defaultChargingStation, this.defaultConnectorId, this.numberTag, this.defaultMeterStart, moment());
    await this.dataHelper.startTransaction(this.defaultChargingStation, this.defaultConnectorId, this.numberTag.toString(), this.defaultMeterStart, moment());

    await this.dataHelper15.startTransaction(this.defaultChargingStation15, this.defaultConnectorId, this.numberTag, this.defaultMeterStart, moment());
    await this.dataHelper15.startTransaction(this.defaultChargingStation15, this.defaultConnectorId, this.numberTag.toString(), this.defaultMeterStart, moment());
  });

  it('Should be possible to start a transaction with connectorId as string', async () => {
    await this.dataHelper.startTransaction(this.defaultChargingStation, this.defaultConnectorId, this.numberTag, this.defaultMeterStart, moment());
    await this.dataHelper.startTransaction(this.defaultChargingStation, this.defaultConnectorId.toString(), this.numberTag.toString(), this.defaultMeterStart, moment());

    await this.dataHelper15.startTransaction(this.defaultChargingStation15, this.defaultConnectorId, this.numberTag, this.defaultMeterStart, moment());
    await this.dataHelper15.startTransaction(this.defaultChargingStation15, this.defaultConnectorId.toString(), this.numberTag.toString(), this.defaultMeterStart, moment());
  });

  it('Should be possible to start a transaction with meterStart as string', async () => {
    await this.dataHelper.startTransaction(this.defaultChargingStation, this.defaultConnectorId, this.numberTag, this.defaultMeterStart, moment());
    await this.dataHelper.startTransaction(this.defaultChargingStation, this.defaultConnectorId, this.numberTag.toString(), this.defaultMeterStart.toString(), moment());

    await this.dataHelper15.startTransaction(this.defaultChargingStation15, this.defaultConnectorId, this.numberTag, this.defaultMeterStart, moment());
    await this.dataHelper15.startTransaction(this.defaultChargingStation15, this.defaultConnectorId, this.numberTag.toString(), this.defaultMeterStart.toString(), moment());
  });

  it('Should be possible to start a transaction with meterStart greater than 0', async () => {
    await this.dataHelper.startTransaction(this.defaultChargingStation, this.defaultConnectorId, this.numberTag, faker.random.number(100000), moment());

    await this.dataHelper15.startTransaction(this.defaultChargingStation15, this.defaultConnectorId, this.numberTag, faker.random.number(100000), moment());
  });

  it('Should not be possible to start a transaction with a invalid tags', async () => {
    await this.dataHelper.startTransaction(this.defaultChargingStation, this.defaultConnectorId, this.invalidTag, this.defaultMeterStart, moment(), "Invalid");
    await this.dataHelper.startTransaction(this.defaultChargingStation, this.defaultConnectorId, '', this.defaultMeterStart, moment(), "Invalid");
    await this.dataHelper.startTransaction(this.defaultChargingStation, this.defaultConnectorId, undefined, this.defaultMeterStart, moment(), "Invalid");

    await this.dataHelper15.startTransaction(this.defaultChargingStation15, this.defaultConnectorId, this.invalidTag, this.defaultMeterStart, moment(), "Invalid");
    await this.dataHelper15.startTransaction(this.defaultChargingStation15, this.defaultConnectorId, '', this.defaultMeterStart, moment(), "Invalid");
    await this.dataHelper15.startTransaction(this.defaultChargingStation15, this.defaultConnectorId, undefined, this.defaultMeterStart, moment(), "Invalid");
  });

  it('Should not be possible to start a transaction with invalid connectorId', async () => {
    await this.dataHelper.startTransaction(this.defaultChargingStation, 'bla', this.numberTag, this.defaultMeterStart, moment(), "Invalid");
    await this.dataHelper.startTransaction(this.defaultChargingStation, '', this.numberTag.toString(), this.defaultMeterStart, moment(), "Invalid");
    await this.dataHelper.startTransaction(this.defaultChargingStation, -1, this.numberTag.toString(), this.defaultMeterStart, moment(), "Invalid");
    await this.dataHelper.startTransaction(this.defaultChargingStation, undefined, this.numberTag.toString(), this.defaultMeterStart, moment(), "Invalid");

    await this.dataHelper15.startTransaction(this.defaultChargingStation15, 'bla', this.numberTag, this.defaultMeterStart, moment(), "Invalid");
    await this.dataHelper15.startTransaction(this.defaultChargingStation15, '', this.numberTag.toString(), this.defaultMeterStart, moment(), "Invalid");
    await this.dataHelper15.startTransaction(this.defaultChargingStation15, -1, this.numberTag.toString(), this.defaultMeterStart, moment(), "Invalid");
    await this.dataHelper15.startTransaction(this.defaultChargingStation15, undefined, this.numberTag.toString(), this.defaultMeterStart, moment(), "Invalid");
  });

  it('Should not be possible to start a transaction with invalid meterStart', async () => {
    await this.dataHelper.startTransaction(this.defaultChargingStation, this.defaultConnectorId, this.numberTag, 'bla', moment(), "Invalid");
    await this.dataHelper.startTransaction(this.defaultChargingStation, this.defaultConnectorId, this.numberTag.toString(), '', moment(), "Invalid");
    await this.dataHelper.startTransaction(this.defaultChargingStation, this.defaultConnectorId, this.numberTag.toString(), undefined, moment(), "Invalid");

    await this.dataHelper15.startTransaction(this.defaultChargingStation15, this.defaultConnectorId, this.numberTag, 'bla', moment(), "Invalid");
    await this.dataHelper15.startTransaction(this.defaultChargingStation15, this.defaultConnectorId, this.numberTag.toString(), '', moment(), "Invalid");
    await this.dataHelper15.startTransaction(this.defaultChargingStation15, this.defaultConnectorId, this.numberTag.toString(), undefined, moment(), "Invalid");
  });

  it('Should be possible to stop a transaction without transactionData', async () => {
    const transacId = await this.dataHelper.startTransaction(this.defaultChargingStation, this.defaultConnectorId, this.numberTag, this.defaultMeterStart, moment());
    await this.dataHelper.stopTransaction(this.defaultChargingStation, transacId, this.numberTag, faker.random.number(100000), moment());

    const transacId15 = await this.dataHelper15.startTransaction(this.defaultChargingStation15, this.defaultConnectorId, this.numberTag, this.defaultMeterStart, moment());
    await this.dataHelper15.stopTransaction(this.defaultChargingStation15, transacId15, this.numberTag, faker.random.number(100000), moment());
  });

  it('Should be possible to stop a transaction with transactionData', async () => {
    const startDate = moment();
    const transacId = await this.dataHelper.startTransaction(this.defaultChargingStation, this.defaultConnectorId, this.numberTag, this.defaultMeterStart, startDate);

    const stopDate = moment();
    const stopValue = faker.random.number(100000);
    const transacData = [
      {
        "timestamp": startDate.toISOString(),
        "sampledValue": [
          {
            "value": this.defaultMeterStart,
            "context": "Transaction.Begin",
            "format": "Raw",
            "measurand": "Energy.Active.Import.Register",
            "location": "Outlet",
            "unit": "Wh"
          }
        ]
      },
      {
        "timestamp": stopDate.toISOString(),
        "sampledValue": [
          {
            "value": stopValue,
            "context": "Transaction.End",
            "format": "Raw",
            "measurand": "Energy.Active.Import.Register",
            "location": "Outlet",
            "unit": "Wh"
          }
        ]
      }
    ];

    await this.dataHelper.stopTransaction(this.defaultChargingStation, transacId, this.numberTag, stopValue, stopDate, transacData);

    const startDate15 = moment();
    const transacId15 = await this.dataHelper15.startTransaction(this.defaultChargingStation15, this.defaultConnectorId, this.numberTag, this.defaultMeterStart, startDate15);

    const stopDate15 = moment();
    const stopValue15 = faker.random.number(100000);
    const transacData15 = {
      "values": [
        {
          "timestamp": startDate15.toISOString(),
          "value": {
            "attributes": {
              "context": "Transaction.Begin",
              "format": "Raw",
              "location": "Outlet",
              "measurand": "Energy.Active.Import.Register",
              "unit": "Wh"
            },
            "$value": this.defaultMeterStart,
          }
        },
        {
          "timestamp": stopDate15.toISOString(),
          "value": {
            "attributes": {
              "context": "Transaction.End",
              "format": "Raw",
              "location": "Outlet",
              "measurand": "Energy.Active.Import.Register",
              "unit": "Wh"
            },
            "$value": stopValue15
          }
        }
      ]
    };
    await this.dataHelper15.stopTransaction(this.defaultChargingStation15, transacId15, this.numberTag, stopValue15, stopDate15, transacData15);
  });

  it('Should not be possible to stop a transaction with invalid transactionData', async () => {
    const startDate = moment();
    const stopDate = moment();
    const stopValue = faker.random.number(100000);
    const transacData = [
      {
        "timestamp": startDate.toISOString(),
        "sampledValue": [
          {
            "value": this.defaultMeterStart,
            "context": "Transaction.Begin",
            "format": "Raw",
            "measurand": "Energy.Active.Import.Register",
            "location": "Outlet",
            "unit": "Wh"
          }
        ]
      },
      {
        "timestamp": stopDate.toISOString(),
        "sampledValue": [
          {
            "value": stopValue,
            "context": "Transaction.End",
            "format": "Raw",
            "measurand": "Energy.Active.Import.Register",
            "location": "Outlet",
            "unit": "Wh"
          }
        ]
      }
    ];

    const startDate15 = moment();
    const stopDate15 = moment();
    const stopValue15 = faker.random.number(100000);
    const transacData15 = {
      "values": [
        {
          "timestamp": startDate15.toISOString(),
          "value": {
            "attributes": {
              "context": "Transaction.Begin",
              "format": "Raw",
              "location": "Outlet",
              "measurand": "Energy.Active.Import.Register",
              "unit": "Wh"
            },
            "$value": this.defaultMeterStart,
          }
        },
        {
          "timestamp": stopDate15.toISOString(),
          "value": {
            "attributes": {
              "context": "Transaction.End",
              "format": "Raw",
              "location": "Outlet",
              "measurand": "Energy.Active.Import.Register",
              "unit": "Wh"
            },
            "$value": stopValue15
          }
        }
      ]
    };

    const transacId = await this.dataHelper.startTransaction(this.defaultChargingStation, this.defaultConnectorId, this.numberTag, this.defaultMeterStart, startDate);

    await this.dataHelper.stopTransaction(this.defaultChargingStation, transacId, this.numberTag, stopValue, stopDate, transacData15,  'Invalid');

    await this.dataHelper.stopTransaction(this.defaultChargingStation, transacId, this.numberTag, stopValue, stopDate);

    const transacId15 = await this.dataHelper15.startTransaction(this.defaultChargingStation15, this.defaultConnectorId, this.numberTag, this.defaultMeterStart, startDate15);

    await this.dataHelper15.stopTransaction(this.defaultChargingStation15, transacId15, this.numberTag, stopValue15, stopDate15, transacData,  'Invalid');

    await this.dataHelper.stopTransaction(this.defaultChargingStation15, transacId15, this.numberTag, stopValue15, stopDate15);
  });

  it('Should be possible to retrieve the last reboot date', async () => {
    const bootNotification = await this.dataHelper.sendBootNotification(this.defaultChargingStation);
    let chargingStationResponse = await this.dataHelper.getChargingStation(this.defaultChargingStation, false);

    expect(bootNotification.currentTime).to.equal(chargingStationResponse.data.lastReboot);

    const bootNotification2 = await this.dataHelper.sendBootNotification(this.defaultChargingStation);
    chargingStationResponse = await this.dataHelper.getChargingStation(this.defaultChargingStation, false);

    expect(bootNotification2.currentTime).to.equal(chargingStationResponse.data.lastReboot);

    expect(bootNotification.currentTime).to.not.equal(bootNotification2.currentTime);
    expect(new Date(bootNotification.currentTime)).to.beforeTime(new Date(bootNotification2.currentTime));


    const bootNotification15 = await this.dataHelper15.sendBootNotification(this.defaultChargingStation15);
    let chargingStationResponse15 = await this.dataHelper15.getChargingStation(this.defaultChargingStation15, false);

    expect(bootNotification15.currentTime.toISOString()).to.equal(chargingStationResponse15.data.lastReboot);

    const bootNotification152 = await this.dataHelper15.sendBootNotification(this.defaultChargingStation15);
    chargingStationResponse15 = await this.dataHelper15.getChargingStation(this.defaultChargingStation15, false);

    expect(bootNotification152.currentTime.toISOString()).to.equal(chargingStationResponse15.data.lastReboot);

    expect(bootNotification15.currentTime).to.not.equal(bootNotification152.currentTime);
    expect(bootNotification15.currentTime).to.beforeTime(bootNotification152.currentTime);
  });
});

