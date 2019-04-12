const path = require('path');
global.appRoot = path.resolve(__dirname, '../../src');
const chai = require('chai');
const {expect} = require('chai');
const chaiSubset = require('chai-subset');
chai.use(chaiSubset);
const moment = require('moment');
const faker = require('faker');
const DataHelper = require('./DataHelper');
const CentralServerService = require('../api/client/CentralServerService');
const Factory = require('../factories/Factory');

describe('OCPP Specific tests', function() {
  this.timeout(10000);
  
  before(async () => {
  });

  after(async () => {
  });

  // it('OCPP 1.6 - KEBA Sample.Clock in MeterValues - Should not be taken into account', async () => {
  //   // const requestHandler = [];
  //   this.tenantID = await CentralServerService.authenticatedApi.getTenantID();
  //   const connectorId = 1;
  //   const tagId = user.tagIDs[0];
  //   const meterStart = 0;
  //   const startDate = moment();
  //   const currentTime = startDate.clone();
  //   let cumulated = meterStart;
  //   // Start Transaction
  //   const transactionId = await this.dataHelper.startTransaction(this.chargingStation, connectorId, tagId, meterStart, startDate);
  //   // Send consumptions
  //   await this.dataHelper.sendConsumptionMeterValue(this.chargingStation, connectorId, transactionId, cumulated+=300, currentTime.add(1, 'minute').clone());
  //   await this.dataHelper.sendConsumptionMeterValue(this.chargingStation, connectorId, transactionId, cumulated+=300, currentTime.add(1, 'minute').clone());
  //   await this.dataHelper.sendConsumptionMeterValue(this.chargingStation, connectorId, transactionId, cumulated+=300, currentTime.add(1, 'minute').clone());
  //   await this.dataHelper.sendClockMeterValue(this.chargingStation, connectorId, transactionId, 0, currentTime.clone());
  //   await this.dataHelper.sendConsumptionMeterValue(this.chargingStation, connectorId, transactionId, cumulated+=300, currentTime.add(1, 'minute').clone());
  //   await this.dataHelper.stopTransaction(this.chargingStation, transactionId, tagId, cumulated, currentTime.add(1, 'minute').clone());
  //   // Read the transaction
  //   const response = await CentralServerService.transactionApi.readById(transactionId);
  //   // Check
  //   expect(response.status).to.equal(200);
  //   expect(response.data).to.deep.containSubset({
  //     id: transactionId,
  //     meterStart: meterStart,
  //     stop: {
  //       totalConsumption: cumulated - meterStart,
  //       totalInactivitySecs: 60
  //     }
  //   });
  // });
});

