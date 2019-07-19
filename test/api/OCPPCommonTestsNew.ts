import chai, { expect } from 'chai';
import chaiSubset from 'chai-subset';
import faker from 'faker';
import moment from 'moment';
import CentralServerService from './client/CentralServerService';
import OCPPService from './ocpp/OCPPService';
import CONTEXTS from './contextProvider/ContextConstants';
import ChargingStationContext from './contextProvider/ChargingStationContext';

chai.use(chaiSubset);

export default class OCPPCommonTestsNew {

  public tenantContext: any;
  public chargingStationContext: ChargingStationContext;
  public centralUserContext: any;
  public centralUserService: any;

  public currentPricingSetting;
  public priceKWH = 2;
  public chargingStationConnector1: any;
  public chargingStationConnector2: any;
  public transactionStartUser: any;
  public transactionStopUser: any;
  public transactionStartMeterValue: any;
  public transactionStartSoC: any;
  public transactionMeterValues: any;
  public transactionMeterSoCValues: any;
  public transactionSignedData: any;
  public transactionEndSignedData: any;
  public transactionMeterValueIntervalSecs: any;
  public transactionStartTime: any;
  public transactionTotalConsumption: any;
  public transactionEndMeterValue: any;
  public transactionEndSoC: any;
  public transactionTotalInactivity: any;
  public totalPrice: any;
  public newTransaction: any;
  public transactionCurrentTime: any;

  public constructor(tenantContext, chargingStationContext, centralUserContext, startUserContext, stopUserContext?) {
    this.tenantContext = tenantContext;
    this.chargingStationContext = chargingStationContext;
    this.centralUserContext = centralUserContext;
    this.centralUserService = new CentralServerService(this.tenantContext.getTenant().subdomain, this.centralUserContext);
    this.transactionStartUser = startUserContext;
    if (stopUserContext) {
      this.transactionStopUser = stopUserContext;
    } else {
      this.transactionStopUser = this.transactionStartUser;
    }
  }

  public async before() {
    const allSettings = await this.centralUserService.settingApi.readAll();
    this.currentPricingSetting = allSettings.data.result.find((s) => {
      return s.identifier === 'pricing';
    });
    if (this.currentPricingSetting) {
      await this.centralUserService.updatePriceSetting(this.priceKWH, 'EUR');
    }
    // Default Connector values
    this.chargingStationConnector1 = {
      connectorId: 1,
      status: 'Available',
      errorCode: 'NoError',
      timestamp: new Date().toISOString()
    };
    this.chargingStationConnector2 = {
      connectorId: 2,
      status: 'Available',
      errorCode: 'NoError',
      timestamp: new Date().toISOString()
    };
    // Set meter value start
    this.transactionStartMeterValue = 0;
    this.transactionSignedData = 'DT785uwRY0zBF9ZepmQV94mK08l4ovYHgsraT8Z00l1p7jVRgq';
    this.transactionEndSignedData = 'WZ2eLegGcstPRqYpsu7JQEMZSnUP6XTNzJJfBDKpAYgtXrNQSM';
    this.transactionMeterValues = Array.from({ length: 12 }, () => {
      return faker.random.number({
        min: 200,
        max: 500
      });
    }).concat([0, 0]);
    this.transactionMeterSoCValues = Array.from({ length: 10 }, () => {
      return faker.random.number({
        min: 0,
        max: 90
      });
    }).concat([98, 99, 100, 100]).sort((a, b) => {
      return (a - b);
    });
    this.transactionStartSoC = this.transactionMeterSoCValues[0];
    this.transactionMeterValueIntervalSecs = 60;
    this.transactionStartTime = moment().subtract(this.transactionMeterValues.length * this.transactionMeterValueIntervalSecs + 1, 'seconds');
    this.transactionTotalConsumption = this.transactionMeterValues.reduce((sum, meterValue) => {
      return sum + meterValue;
    });
    this.transactionEndMeterValue = this.transactionStartMeterValue + this.transactionTotalConsumption;
    this.transactionEndSoC = 100;
    this.transactionTotalInactivity = this.transactionMeterValues.reduce(
      (sum, meterValue) => {
        return (meterValue === 0 ? sum + this.transactionMeterValueIntervalSecs : sum);
      }, 0);
    this.totalPrice = this.priceKWH * (this.transactionTotalConsumption / 1000);
  }

  public async after() {
    if (this.currentPricingSetting) {
      await this.centralUserService.settingApi.update(this.currentPricingSetting);
    }
  }

  public async testConnectorStatus() {
    let response = await this.chargingStationContext.setConnectorStatus(this.chargingStationConnector1);
    expect(response.data).to.eql({});
    response = await this.chargingStationContext.setConnectorStatus(this.chargingStationConnector2);
    expect(response.data).to.eql({});
    // Attention: connector status is always 'Unavailable', if too much time has passed since last heartbeat!!
    response = await this.chargingStationContext.sendHeartbeat();
    // Now we can test the connector status!
    response = await this.chargingStationContext.readChargingStation();
    expect(response.status).to.equal(200);
    expect(response.data.id).is.eql(this.chargingStationContext.getChargingStation().id);
    // Check both Connectors
    const foundChargingStation = response.data;
    // Check
    expect(foundChargingStation.connectors).to.not.be.null;
    expect(foundChargingStation.connectors[0]).to.include({ status: this.chargingStationConnector1.status, errorCode: this.chargingStationConnector1.errorCode });
    expect(foundChargingStation.connectors[1]).to.include({ status: this.chargingStationConnector2.status, errorCode: this.chargingStationConnector2.errorCode });
  }

  public async testChangeConnectorStatus() {
    // Set it to Occupied
    this.chargingStationConnector1.status = 'Occupied';
    this.chargingStationConnector1.timestamp = new Date().toISOString();
    // Update
    let response = await this.chargingStationContext.setConnectorStatus(this.chargingStationConnector1);
    // Check
    expect(response.data).to.eql({});
    // To be sure send a heartbeat
    response = await this.chargingStationContext.sendHeartbeat();
    // Check the connectors
    response = await this.chargingStationContext.readChargingStation();
    expect(response.status).to.equal(200);
    expect(response.data.id).is.eql(this.chargingStationContext.getChargingStation().id);
    const foundChargingStation = response.data;
    // Check Connector 1
    expect(foundChargingStation.connectors[0]).to.include({ status: this.chargingStationConnector1.status, errorCode: this.chargingStationConnector1.errorCode });
    // Connector 2 should be still 'Available'
    expect(foundChargingStation.connectors[1]).to.include({ status: this.chargingStationConnector2.status, errorCode: this.chargingStationConnector2.errorCode });
    // Reset Status of Connector 1
    this.chargingStationConnector1.status = 'Available';
    this.chargingStationConnector1.timestamp = new Date().toISOString();
    // Update
    response = await this.chargingStationContext.setConnectorStatus(this.chargingStationConnector1);
    // Check
    expect(response.data).to.eql({});
  }

  public async testHeartbeat() {
    // Update Status of Connector 1
    const response = await this.chargingStationContext.sendHeartbeat();
    // Check
    expect(response.data).to.have.property('currentTime');
  }

  public async testDataTransfer() {
    // Check
    const response = await this.chargingStationContext.transferData({
      'vendorId': 'Schneider Electric',
      'messageId': 'Detection loop',
      'data': '{\\"connectorId\\":2,\\"name\\":\\"Vehicle\\",\\"state\\":\\"0\\",\\"timestamp\\":\\"2018-08-08T10:21:11Z:\\"}',
      'chargeBoxID': this.chargingStationContext.getChargingStation().id,
      'timestamp': new Date().toDateString()
    });
    // Check
    expect(response.data).to.have.property('status');
    expect(response.data.status).to.equal('Accepted');
  }

  public async testAuthorizeUsers() {
    // Asserts that the start user is authorized.
    await this.testAuthorize(this.transactionStartUser.tagIDs[0], 'Accepted');
    // Asserts that the stop user is authorized.
    await this.testAuthorize(this.transactionStopUser.tagIDs[0], 'Accepted');
    // Asserts that the user with a too long tag is not authorized.
    await this.testAuthorize('ThisIsATooTooTooLongTag', 'Invalid');
  }

  public async testStartTransaction(withSoC = false) {
    // Start a new Transaction
    const response = await this.chargingStationContext.startTransaction(
      this.chargingStationConnector1.connectorId,
      this.transactionStartUser.tagIDs[0],
      this.transactionStartMeterValue,
      this.transactionStartTime
    );
    const transactionId = response.data.transactionId;
    await this.validateStartedTransaction(
      response,
      this.chargingStationConnector1,
      this.transactionStartMeterValue,
      this.transactionStartTime);
    this.newTransaction = (await this.centralUserService.transactionApi.readById(transactionId)).data;
    expect(this.newTransaction).to.not.be.null;
  }

  public async testStartSecondTransaction(withSoC = false) {
    // Check on current transaction
    expect(this.newTransaction).to.not.be.null;
    // Set
    const transactionId = this.newTransaction.id;
    this.transactionStartTime = moment().subtract(1, 'h');
    // Clear old one
    this.newTransaction = null;
    // Start the 2nd Transaction
    const response = await this.chargingStationContext.startTransaction(
      this.chargingStationConnector1.connectorId,
      this.transactionStartUser.tagIDs[0],
      this.transactionStartMeterValue,
      this.transactionStartTime
    );
    const secondTransactionId = response.data.transactionId;
    await this.validateStartedTransaction(
      response,
      this.chargingStationConnector1,
      this.transactionStartMeterValue,
      this.transactionStartTime);
    // Check if the Transaction exists
    this.newTransaction = (await this.centralUserService.transactionApi.readById(secondTransactionId)).data;
    // Check
    expect(this.newTransaction).to.not.be.null;
    expect(this.newTransaction.id).to.not.equal(transactionId);
  }

  public async testSendMeterValues(withSoC = false, withSignedData = false) {
    // Check on Transaction
    expect(this.newTransaction).to.not.be.null;
    // Current Time matches Transaction one
    this.transactionCurrentTime = moment(this.newTransaction.timestamp);
    // Start Meter Value matches Transaction one
    let transactionCurrentMeterValue = this.transactionStartMeterValue;
    // Send Transaction.Begin
    let response = await this.chargingStationContext.sendBeginMeterValue(
      this.newTransaction.connectorId,
      this.newTransaction.transactionId,
      transactionCurrentMeterValue,
      this.transactionStartSoC,
      this.transactionSignedData,
      this.transactionCurrentTime,
      withSoC,
      withSignedData);
    if (response) {
      expect(response.data).to.eql({});
    }
    // Check Transaction
    response = await this.basicTransactionValidation(this.newTransaction.id, this.newTransaction.connectorId, this.newTransaction.meterStart, this.newTransaction.timestamp);
    // Send Meter Values (except the last one which will be used in Stop Transaction)
    for (let index = 0; index <= this.transactionMeterValues.length - 2; index++) {
      // Set new meter value
      transactionCurrentMeterValue += this.transactionMeterValues[index];
      // Add time
      this.transactionCurrentTime.add(this.transactionMeterValueIntervalSecs, 's');
      // Send consumption meter value
      response = await this.chargingStationContext.sendTransactionMeterValue(
        this.newTransaction.connectorId,
        this.newTransaction.transactionId,
        transactionCurrentMeterValue,
        this.transactionMeterSoCValues[index],
        this.transactionCurrentTime,
        withSoC);
      expect(response.data).to.eql({});
      // Check the Consumption
      response = await this.basicTransactionValidation(this.newTransaction.id, this.newTransaction.connectorId, this.newTransaction.meterStart, this.newTransaction.timestamp);
      expect(response.data).to.deep.include({
        currentConsumption: (this.transactionMeterValues[index] * this.transactionMeterValueIntervalSecs),
        currentTotalConsumption: (transactionCurrentMeterValue - this.transactionStartMeterValue)
      });
      if (withSoC) {
        expect(response.data).to.deep.include({
          currentStateOfCharge: this.transactionMeterSoCValues[index]
        });
      } else {
        expect(response.data).to.deep.include({
          stateOfCharge: this.newTransaction.stateOfCharge
        });
      }
    }
    // Send Transaction.End
    response = await this.chargingStationContext.sendEndMeterValue(
      this.newTransaction.connectorId,
      this.newTransaction.transactionId,
      this.transactionEndMeterValue,
      this.transactionEndSoC,
      this.transactionEndSignedData,
      moment(this.transactionCurrentTime),
      withSoC,
      withSignedData);
    if (response) {
      expect(response.data).to.eql({});
    }
    // Check the Transaction End
    response = await this.basicTransactionValidation(this.newTransaction.id, this.newTransaction.connectorId, this.newTransaction.meterStart, this.newTransaction.timestamp);
    if (withSoC) {
      expect(response.data).to.deep.include({
        currentStateOfCharge: this.transactionEndSoC
      });
    } else {
      expect(response.data).to.deep.include({
        stateOfCharge: this.newTransaction.stateOfCharge
      });
    }
  }

  public async testStopTransaction(withSoC = false) {
    // Check on Transaction
    expect(this.newTransaction).to.not.be.null;
    expect(this.transactionCurrentTime).to.not.be.null;

    // Set end time
    this.transactionCurrentTime.add(this.transactionMeterValueIntervalSecs, 's');

    // Stop the Transaction
    let response = await this.chargingStationContext.stopTransaction(this.newTransaction.id, this.transactionStopUser.tagIDs[0], this.transactionEndMeterValue, this.transactionCurrentTime);
    // Check
    expect(response.data).to.have.property('idTagInfo');
    expect(response.data.idTagInfo.status).to.equal('Accepted');

    // Set the connector to Available
    this.chargingStationConnector1.status = 'Available';
    this.chargingStationConnector1.timestamp = new Date().toISOString();
    // Update
    response = await this.chargingStationContext.setConnectorStatus(this.chargingStationConnector1);
    // Check
    expect(response.data).to.eql({});

    // Check the Transaction
    response = await this.basicTransactionValidation(this.newTransaction.id, this.newTransaction.connectorId, this.newTransaction.meterStart, this.newTransaction.timestamp);
    expect(response.data).to.deep['containSubset']({
      'isLoading': false,
      //      'stateOfCharge': (withSoC ? this.transactionStartSoC : 0),
      'stop': {
        'meterStop': this.transactionEndMeterValue,
        'totalConsumption': this.transactionTotalConsumption,
        'totalInactivitySecs': this.transactionTotalInactivity,
        'totalDurationSecs': moment.duration(moment(this.transactionCurrentTime).diff(this.newTransaction.timestamp)).asSeconds(),
        'price': this.totalPrice,
        'priceUnit': 'EUR',
        'pricingSource': 'simple',
        'roundedPrice': parseFloat(this.totalPrice.toFixed(2)),
        'tagID': this.transactionStopUser.tagIDs[0],
        'timestamp': this.transactionCurrentTime.toISOString(),
        'stateOfCharge': (withSoC ? this.transactionEndSoC : 0),
        'user': {
          'id': this.transactionStopUser.id,
          'name': this.transactionStopUser.name,
          'firstName': this.transactionStopUser.firstName
        }
      }
    });
  }

  public async testTransactionMetrics(withSoC = false, withSignedData = false) {
    // Check on Transaction
    expect(this.newTransaction).to.not.be.null;

    // Get the Consumption
    const response = await this.centralUserService.transactionApi.readAllConsumption({ TransactionId: this.newTransaction.id });
    expect(response.status).to.equal(200);
    // Check Headers
    expect(response.data).to.deep['containSubset']({
      'chargeBoxID': this.newTransaction.chargeBoxID,
      'connectorId': this.newTransaction.connectorId,
      //      'stateOfCharge': (withSoC ? this.transactionStartSoC : 0),
      'signedData': (withSignedData ? this.transactionSignedData : ''),
      'stop': {
        'price': this.totalPrice,
        'pricingSource': 'simple',
        'roundedPrice': parseFloat(this.totalPrice.toFixed(2)),
        'tagID': this.transactionStopUser.tagIDs[0],
        'totalConsumption': this.transactionTotalConsumption,
        'totalInactivitySecs': this.transactionTotalInactivity,
        'stateOfCharge': (withSoC ? this.transactionEndSoC : 0),
        'signedData': (withSignedData ? this.transactionEndSignedData : ''),
        'user': {
          'id': this.transactionStopUser.id,
          'name': this.transactionStopUser.name,
          'firstName': this.transactionStopUser.firstName
        }
      },
      'id': this.newTransaction.id,
      'user': {
        'id': this.transactionStartUser.id,
        'name': this.transactionStartUser.name,
        'firstName': this.transactionStartUser.firstName
      }
    });
    // Init
    const transactionCurrentTime = moment(this.newTransaction.timestamp);
    let transactionCumulatedConsumption = this.transactionStartMeterValue;
    // Check Consumption
    for (let i = 0; i < response.data.values.length; i++) {
      // Get the value
      const value = response.data.values[i];
      // Check
      expect(value).to.include({
        'chargeBoxID': this.newTransaction.chargeBoxID,
        'connectorId': this.newTransaction.connectorId,
        'date': transactionCurrentTime.toISOString(),
        'value': (i > 0 ? this.transactionMeterValues[i - 1] * this.transactionMeterValueIntervalSecs : this.transactionStartMeterValue),
        'cumulated': transactionCumulatedConsumption
      });
      if (withSoC) {
        // Check
        expect(value).to.include({
          'stateOfCharge': (i > 0 ? this.transactionMeterSoCValues[i - 1] : this.transactionStartSoC)
        });
      }
      // Add time
      transactionCurrentTime.add(this.transactionMeterValueIntervalSecs, 's');
      // Sum
      transactionCumulatedConsumption += this.transactionMeterValues[i];
    }
  }

  public async testDeleteTransaction() {
    // Delete the created entity
    expect(this.newTransaction).to.not.be.null;
    const response = await this.centralUserService.transactionApi.delete(this.newTransaction.id);
    expect(response.status).to.equal(200);
    expect(response.data).to.have.property('status');
    expect(response.data.status).to.be.eql('Success');
    this.newTransaction = null;
  }

  public async testConnectorStatusToStopTransaction() {
    // Check on Transaction
    this.newTransaction = null;
    expect(this.chargingStationConnector1.status).to.eql('Available');

    // Start a new Transaction
    await this.testStartTransaction();
    const transactionId = this.newTransaction.id;
    expect(transactionId).to.not.equal(0);

    this.chargingStationConnector1.status = 'Available';
    this.chargingStationConnector1.errorCode = 'NoError';
    this.chargingStationConnector1.timestamp = new Date().toISOString();
    // Update Status of Connector 1
    let response = await this.chargingStationContext.setConnectorStatus(this.chargingStationConnector1);
    // Check
    expect(response.data).to.eql({});
    // Send Heartbeat to have an active charger
    response = await this.chargingStationContext.sendHeartbeat();
    // Now we can test the connector status!
    response = await this.chargingStationContext.readChargingStation();
    expect(response.status).to.equal(200);
    expect(response.data.id).is.eql(this.chargingStationContext.getChargingStation().id);
    // Check Connector1
    const foundChargingStation = response.data;
    expect(foundChargingStation.connectors).to.not.be.null;
    expect(foundChargingStation.connectors[0]).to.include({ status: this.chargingStationConnector1.status, errorCode: this.chargingStationConnector1.errorCode });
    // Check Transaction
    this.newTransaction = (await this.centralUserService.transactionApi.readById(transactionId)).data;
    expect(this.newTransaction.message).to.contain('does not exist');
  }

  private async testAuthorize(tagId, expectedStatus) {
    const response = await this.chargingStationContext.authorize(tagId);
    // Check
    expect(response.data).to.have.property('idTagInfo');
    expect(response.data.idTagInfo.status).to.equal(expectedStatus);
  }

  private async validateStartedTransaction(response, chargingStationConnector, startMeterValue, startTime) {
    expect(response.data).to.have.property('idTagInfo');
    expect(response.data.idTagInfo.status).to.equal('Accepted');
    expect(response.data).to.have.property('transactionId');
    expect(response.data.transactionId).to.not.equal(0);
    const transactionId = response.data.transactionId;
    // Update connector status
    chargingStationConnector.status = 'Occupied';
    chargingStationConnector.timestamp = new Date().toISOString();
    let responseValidate = await this.chargingStationContext.setConnectorStatus(chargingStationConnector);
    // Check connector status
    expect(responseValidate.data).to.eql({});
    responseValidate = await this.basicTransactionValidation(transactionId, chargingStationConnector.connectorId, startMeterValue, startTime.toISOString());
    expect(responseValidate.data).to.deep.include({
      currentConsumption: 0,
      currentCumulatedPrice: 0,
      currentStateOfCharge: 0,
      currentTotalConsumption: 0,
      currentTotalInactivitySecs: 0,
      isLoading: false,
      price: 0,
      roundedPrice: 0,
    });
  }

  private async basicTransactionValidation(transactionId, connectorId, meterStart, timestamp) {
    const response = await this.centralUserService.transactionApi.readById(transactionId);
    expect(response.status).to.equal(200);
    expect(response.data).to.deep['containSubset']({
      'id': transactionId,
      'timestamp': timestamp,
      'chargeBoxID': this.chargingStationContext.getChargingStation().id,
      'connectorId': connectorId,
      'tagID': this.transactionStartUser.tagIDs[0],
      'meterStart': meterStart,
      'user': {
        'id': this.transactionStartUser.id,
        'name': this.transactionStartUser.name,
        'firstName': this.transactionStartUser.firstName
      }
    });

    return response;
  }

}
