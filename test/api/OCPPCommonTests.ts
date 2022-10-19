/* eslint-disable max-len */
import { ChargePointErrorCode, ChargePointStatus, OCPP15TransactionData, OCPPAuthorizationStatus, OCPPMeterValue, OCPPReadingContext, OCPPStatusNotificationRequest, OCPPVersion } from '../../src/types/ocpp/OCPPServer';
import Transaction, { InactivityStatus } from '../../src/types/Transaction';
import chai, { assert, expect } from 'chai';

import CentralServerService from './client/CentralServerService';
import ChargingStationContext from './context/ChargingStationContext';
import Constants from '../../src/utils/Constants';
import ContextDefinition from './context/ContextDefinition';
import Factory from '../factories/Factory';
import { OCPPStatus } from '../../src/types/ocpp/OCPPClient';
import { StatusCodes } from 'http-status-codes';
import Tag from '../../src/types/Tag';
import TenantContext from './context/TenantContext';
import User from '../../src/types/User';
import Utils from '../../src/utils/Utils';
import chaiSubset from 'chai-subset';
import { fail } from 'assert';
import { faker } from '@faker-js/faker';
import moment from 'moment';
import responseHelper from '../helpers/responseHelper';

chai.use(chaiSubset);
chai.use(responseHelper);

export default class OCPPCommonTests {
  public tenantContext: TenantContext;
  public chargingStationContext: ChargingStationContext;
  public centralUserContext: any;
  public centralUserService: CentralServerService;

  public currentPricingSetting;

  public chargingStationConnector1: OCPPStatusNotificationRequest;
  public chargingStationConnector2: OCPPStatusNotificationRequest;

  public transactionStartUser;
  public transactionStartUserService: CentralServerService;
  public transactionStopUser;

  public energyActiveImportStartMeterValue: number;
  public energyActiveImportEndMeterValue: number;
  public energyActiveImportMeterValues: number[];

  public socMeterValues: number[];

  public powerImportMeterValues: number[];
  public powerImportL1MeterValues: number[];
  public powerImportL2MeterValues: number[];
  public powerImportL3MeterValues: number[];

  public voltageMeterValues: number[];
  public voltageL1MeterValues: number[];
  public voltageL2MeterValues: number[];
  public voltageL3MeterValues: number[];

  public amperageMeterValues: number[];
  public amperageL1MeterValues: number[];
  public amperageL2MeterValues: number[];
  public amperageL3MeterValues: number[];

  public transactionStartSignedData: string;
  public transactionEndSignedData: string;

  public totalInactivities: number[];
  public meterValueIntervalSecs: number;
  public transactionStartTime: Date;
  public transactionTotalConsumptionWh: number;
  public transactionTotalInactivitySecs: number;
  public totalPrice: number;

  public newTransaction: Transaction;
  public transactionCurrentTime: Date;

  public createAnyUser = false;
  public numberTag: number;
  public validTag: string;
  public invalidTag: string;
  public anyUser: User;
  public anyTag: Tag;
  public createdUsers: User[] = [];
  public createdTags: Tag[] = [];

  public constructor(tenantContext: TenantContext, centralUserContext, createAnyUser = false) {
    expect(tenantContext).to.exist;
    this.tenantContext = tenantContext;
    this.centralUserContext = centralUserContext;
    expect(centralUserContext).to.exist;
    // Avoid double login for identical user contexts
    const centralAdminUserService = this.tenantContext.getAdminCentralServerService();
    if (this.centralUserContext.email === centralAdminUserService.getAuthenticatedUserEmail()) {
      this.centralUserService = centralAdminUserService;
    } else {
      this.centralUserService = new CentralServerService(this.tenantContext.getTenant().subdomain, this.centralUserContext);
    }
    this.createAnyUser = createAnyUser;
  }

  public setChargingStation(chargingStationContext: ChargingStationContext): void {
    expect(chargingStationContext).to.exist;
    this.chargingStationContext = chargingStationContext;
  }

  public setUsers(startUserContext, stopUserContext?): void {
    expect(startUserContext).to.exist;
    this.transactionStartUser = startUserContext;
    if (stopUserContext) {
      this.transactionStopUser = stopUserContext;
    } else {
      this.transactionStopUser = this.transactionStartUser;
    }
    // Avoid double login for identical user contexts
    if (this.transactionStartUser === this.centralUserContext) {
      this.transactionStartUserService = this.centralUserService;
    } else {
      this.transactionStartUserService = new CentralServerService(
        this.tenantContext.getTenant().subdomain, this.transactionStartUser);
    }
  }

  public async assignAnyUserToSite(siteContext): Promise<void> {
    expect(siteContext).to.exist;
    if (this.anyUser) {
      await this.centralUserService.siteApi.addUsersToSite(siteContext.getSite().id, [this.anyUser.id]);
    }
  }

  public async before(): Promise<void> {
    // Default Connector values
    this.chargingStationConnector1 = {
      connectorId: 1,
      status: ChargePointStatus.AVAILABLE,
      errorCode: ChargePointErrorCode.NO_ERROR,
      timestamp: new Date().toISOString()
    };
    this.chargingStationConnector2 = {
      connectorId: 2,
      status: ChargePointStatus.AVAILABLE,
      errorCode: ChargePointErrorCode.NO_ERROR,
      timestamp: new Date().toISOString()
    };
    // Set meter value start
    this.energyActiveImportStartMeterValue = 0;
    this.meterValueIntervalSecs = 60;
    // eslint-disable-next-line no-useless-escape
    this.transactionStartSignedData = '<?xml version=\"1.0\" encoding=\"UTF-8\" ?><signedMeterValue>  <publicKey encoding=\"base64\">8Y5UzWD+TZeMKBDkKLpHhwzSfGsnCvo00ndCXv/LVRD5pAVtRZEA49bqpr/DY3KL</publicKey>  <meterValueSignature encoding=\"base64\">wQdZJR1CLRe+QhS3C+kHpkfVL4hqPhc8YIt/+4uHBBb9N6JNygltdEhYufTfaM++AJ8=</meterValueSignature>  <signatureMethod>ECDSA192SHA256</signatureMethod>  <encodingMethod>EDL</encodingMethod>  <encodedMeterValue encoding=\"base64\">CQFFTUgAAH+eoQxVP10I4Zf9ACcAAAABAAERAP8e/5KqWwEAAAAAAJ9sYQoCAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAtVP10AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=</encodedMeterValue></signedMeterValue>';
    // eslint-disable-next-line no-useless-escape
    this.transactionEndSignedData = '<?xml version=\"1.0\" encoding=\"UTF-8\" ?><signedMeterValue>  <publicKey encoding=\"base64\">8Y5UzWD+TZeMKBDkKLpHhwzSfGsnCvo00ndCXv/LVRD5pAVtRZEA49bqpr/DY3KL</publicKey>  <meterValueSignature encoding=\"base64\">GChPf/f+0Rw6DDWI0mujec6dOMDqm5cuCLXdEVV6MRua6OVqcHNP85q7K70tRPJKAJ8=</meterValueSignature>  <signatureMethod>ECDSA192SHA256</signatureMethod>  <encodingMethod>EDL</encodingMethod>  <encodedMeterValue encoding=\"base64\">CQFFTUgAAH+eodYDQF0IrEb+ACgAAAABAAERAP8e/8OtYQEAAAAAAJ9sYQoCAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAtVP10AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=</encodedMeterValue></signedMeterValue>';
    // Energy Import Meter Value (14 values)
    this.energyActiveImportMeterValues = Array.from({ length: 12 }, () => faker.datatype.number({
      min: 200, max: 500
    })).concat([0, 0]);
    // JUST A TEST to reproduce rounding issues
    // this.energyActiveImportMeterValues = [ 0, 213, 266, 255, 363, 368, 1929, 0, 0, 0, 0, 0, 0, 0 ];
    // SoC Meter Value (14 values)
    this.socMeterValues = Array.from({ length: 8 }, () => faker.datatype.number({
      min: 10, max: 90
    })).concat([8, 8, 98, 99, 100, 100]).sort((a, b) => (a - b));
    // Voltage (14 values)
    this.voltageMeterValues = Array.from({ length: 14 }, () => faker.datatype.number({
      min: 220, max: 240
    }));
    this.voltageL1MeterValues = Array.from({ length: 14 }, () => faker.datatype.number({
      min: 220, max: 240
    }));
    this.voltageL2MeterValues = Array.from({ length: 14 }, () => faker.datatype.number({
      min: 220, max: 240
    }));
    this.voltageL3MeterValues = Array.from({ length: 14 }, () => faker.datatype.number({
      min: 220, max: 240
    }));
    // Amperage (14 values)
    this.amperageL1MeterValues = Array.from({ length: 14 }, () => faker.datatype.number({
      min: 16, max: 32
    }));
    this.amperageL2MeterValues = Array.from({ length: 14 }, () => faker.datatype.number({
      min: 16, max: 32
    }));
    this.amperageL3MeterValues = Array.from({ length: 14 }, () => faker.datatype.number({
      min: 16, max: 32
    }));
    this.amperageMeterValues = [];
    for (let i = 0; i < this.amperageL1MeterValues.length; i++) {
      this.amperageMeterValues.push(this.amperageL1MeterValues[i] + this.amperageL2MeterValues[i] + this.amperageL3MeterValues[i]);
    }
    // Power Import (14 values)
    this.powerImportMeterValues = [];
    for (let i = 0; i < this.amperageMeterValues.length; i++) {
      this.powerImportMeterValues.push(
        this.amperageMeterValues[i] * this.voltageMeterValues[i]);
    }
    this.powerImportL1MeterValues = [];
    for (let i = 0; i < this.amperageL1MeterValues.length; i++) {
      this.powerImportL1MeterValues.push(
        this.amperageL1MeterValues[i] * this.voltageL1MeterValues[i]);
    }
    this.powerImportL2MeterValues = [];
    for (let i = 0; i < this.amperageL2MeterValues.length; i++) {
      this.powerImportL2MeterValues.push(
        this.amperageL2MeterValues[i] * this.voltageL2MeterValues[i]);
    }
    this.powerImportL3MeterValues = [];
    for (let i = 0; i < this.amperageL3MeterValues.length; i++) {
      this.powerImportL3MeterValues.push(
        this.amperageL3MeterValues[i] * this.voltageL3MeterValues[i]);
    }
    // Total Inactivity (14 values)
    this.totalInactivities = [];
    let lastInactivity = 0;
    for (let i = 0; i < this.energyActiveImportMeterValues.length; i++) {
      lastInactivity += (this.energyActiveImportMeterValues[i] === 0 ? this.meterValueIntervalSecs : 0);
      this.totalInactivities.push(lastInactivity);
    }
    // Meter Values params
    this.transactionStartTime = moment().subtract(this.energyActiveImportMeterValues.length * this.meterValueIntervalSecs + 1, 'seconds').toDate();
    this.transactionTotalConsumptionWh = this.energyActiveImportMeterValues.reduce((sum, meterValue) => Utils.createDecimal(sum).plus(meterValue).toNumber());
    this.energyActiveImportEndMeterValue = Utils.createDecimal(this.energyActiveImportStartMeterValue).plus(this.transactionTotalConsumptionWh).toNumber();
    this.transactionTotalInactivitySecs = this.energyActiveImportMeterValues.reduce(
      (sum, meterValue) => (meterValue === 0 ? sum + this.meterValueIntervalSecs : sum), 0);
    // Tags
    this.validTag = faker.random.alphaNumeric(20).toString();
    this.invalidTag = faker.random.alphaNumeric(21).toString();
    this.numberTag = faker.datatype.number(10000);
    if (this.createAnyUser) {
      this.anyUser = await this.createUser(Factory.user.build());
      if (!this.createdUsers) {
        this.createdUsers = [];
      }
      this.createdUsers.push(this.anyUser);
      if (!this.createdTags) {
        this.createdTags = [];
      }
      this.anyTag = (await this.createTag(Factory.tag.build({ id: this.validTag, userID: this.anyUser.id }))).data;
      this.createdTags.push(this.anyTag);
      this.anyTag = (await this.createTag(Factory.tag.build({ id: this.invalidTag, userID: this.anyUser.id }))).data;
      this.createdTags.push(this.anyTag);
      this.anyTag = (await this.createTag(Factory.tag.build({ id: this.numberTag.toString(), userID: this.anyUser.id }))).data;
      this.createdTags.push(this.anyTag);
    }
  }

  public async after(): Promise<void> {
    if (this.currentPricingSetting) {
      await this.centralUserService.settingApi.update(this.currentPricingSetting);
    }
    if (this.createdUsers && Array.isArray(this.createdUsers)) {
      for (const user of this.createdUsers) {
        await this.centralUserService.deleteEntity(
          this.centralUserService.userApi, user);
      }
    }
    if (this.createdTags && Array.isArray(this.createdTags)) {
      for (const tag of this.createdTags) {
        await this.centralUserService.tagApi.deleteTag(tag.id);
      }
    }
  }

  public async testConnectorStatus(): Promise<void> {
    let response = await this.chargingStationContext.setConnectorStatus(this.chargingStationConnector1);
    expect(response).to.eql({});
    response = await this.chargingStationContext.setConnectorStatus(this.chargingStationConnector2);
    expect(response).to.eql({});
    // Warning: connector status is always 'Unavailable' if too much time has passed since last seen!
    response = await this.chargingStationContext.sendHeartbeat();
    // Now we can test the connector status!
    const foundChargingStation = await this.chargingStationContext.readChargingStation();
    expect(foundChargingStation.status).to.equal(StatusCodes.OK);
    expect(foundChargingStation.data.id).is.eql(this.chargingStationContext.getChargingStation().id);
    expect(foundChargingStation.data.connectors).to.not.be.null;
    expect(foundChargingStation.data.connectors[0]).to.include({
      status: this.chargingStationConnector1.status,
      errorCode: this.chargingStationConnector1.errorCode
    });
    expect(foundChargingStation.data.connectors[1]).to.include({
      status: this.chargingStationConnector2.status,
      errorCode: this.chargingStationConnector2.errorCode
    });
  }

  public async testChangeConnectorStatus(): Promise<void> {
    // Set it to Occupied
    this.chargingStationConnector1.status = ChargePointStatus.OCCUPIED;
    this.chargingStationConnector1.timestamp = new Date().toISOString();
    // Update
    let response = await this.chargingStationContext.setConnectorStatus(this.chargingStationConnector1);
    expect(response).to.eql({});
    // To be sure send a heartbeat
    response = await this.chargingStationContext.sendHeartbeat();
    // Check the connectors
    const foundChargingStation = await this.chargingStationContext.readChargingStation();
    expect(foundChargingStation.status).to.equal(StatusCodes.OK);
    expect(foundChargingStation.data.id).is.eql(this.chargingStationContext.getChargingStation().id);
    // Check Connector 1
    expect(foundChargingStation.data.connectors[0]).to.include({
      status: this.chargingStationConnector1.status,
      errorCode: this.chargingStationConnector1.errorCode
    });
    // Connector 2 should be still ChargePointStatus.AVAILABLE
    expect(foundChargingStation.data.connectors[1]).to.include({
      status: this.chargingStationConnector2.status,
      errorCode: this.chargingStationConnector2.errorCode
    });
    // Reset Status of Connector 1
    this.chargingStationConnector1.status = ChargePointStatus.AVAILABLE;
    this.chargingStationConnector1.timestamp = new Date().toISOString();
    // Update
    response = await this.chargingStationContext.setConnectorStatus(this.chargingStationConnector1);
    expect(response).to.eql({});
  }

  public async testHeartbeat(): Promise<void> {
    // Update Status of Connector 1
    const response = await this.chargingStationContext.sendHeartbeat();
    expect(response).to.have.property('currentTime');
  }

  public async testClientIP(): Promise<void> {
    // Read charging station
    const response = await this.chargingStationContext.readChargingStation();
    // Check the presence of the IP
    expect(response.data).to.have.property('currentIPAddress');
    expect(response.data.currentIPAddress).to.not.be.empty;
  }

  public async testDataTransfer(): Promise<void> {
    const response = await this.chargingStationContext.transferData({
      'vendorId': 'Schneider Electric',
      'messageId': 'Detection loop',
      'data': '{\\"connectorId\\":2,\\"name\\":\\"Vehicle\\",\\"state\\":\\"0\\",\\"timestamp\\":\\"2018-08-08T10:21:11Z:\\"}',
    });
    expect(response).to.have.property('status');
    expect(response.status).to.equal(OCPPStatus.ACCEPTED);
  }

  public async testChargingStationRegistrationWithInvalidToken(): Promise<void> {
    try {
      await this.chargingStationContext.sendBootNotification();
      fail('BootNotification should fail');
    } catch (error) {
      expect(error).to.be.not.null;
    }
  }

  public async testChargingStationRegistrationWithInvalidIdentifier(): Promise<void> {
    try {
      await this.chargingStationContext.sendBootNotification();
      fail('BootNotification should fail');
    } catch (error) {
      expect(error).to.be.not.null;
    }
  }

  public async testAuthorizeUsers(): Promise<void> {
    // Asserts that the start user is authorized.
    await this.testAuthorize(this.transactionStartUser.tags[0].id, OCPPStatus.ACCEPTED);
    // Asserts that the stop user is authorized.
    await this.testAuthorize(this.transactionStopUser.tags[0].id, OCPPStatus.ACCEPTED);
    // Asserts that the user with a too long tag is not authorized.
    await this.testAuthorize('ThisIsATooTooTooLongTag', OCPPAuthorizationStatus.INVALID);
  }

  public async testStartTransaction(validTransaction = true): Promise<void> {
    // Start a new Transaction
    const startTransactionResponse = await this.chargingStationContext.startTransaction(
      this.chargingStationConnector1.connectorId,
      this.transactionStartUser.tags[0].id,
      this.energyActiveImportStartMeterValue,
      this.transactionStartTime
    );
    if (validTransaction) {
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(startTransactionResponse).to.be.transactionValid;
      const transactionId = startTransactionResponse.transactionId;
      await this.validateStartedTransaction(
        startTransactionResponse,
        this.chargingStationConnector1,
        this.energyActiveImportStartMeterValue,
        this.transactionStartTime);
      this.newTransaction = (await this.centralUserService.transactionApi.readById(transactionId)).data;
      expect(this.newTransaction).to.not.be.null;

      const chargingStationResponse = await this.chargingStationContext.readChargingStation(this.transactionStartUserService);
      expect(chargingStationResponse.status).eq(StatusCodes.OK);
      expect(chargingStationResponse.data).not.null;
      const connector = chargingStationResponse.data.connectors[this.chargingStationConnector1.connectorId - 1];
      expect(connector).not.null;
      expect(connector.currentTransactionID).eq(transactionId);
      expect(connector.currentTransactionDate).eq(this.transactionStartTime.toISOString());
      expect(connector.currentTagID).eq(this.transactionStartUser.tags[0].id);
    } else {
      this.newTransaction = null;
      expect(startTransactionResponse).to.be.transactionStatus(OCPPAuthorizationStatus.INVALID);
    }
  }

  public async testStartSecondTransaction(): Promise<void> {
    // Check on current transaction
    expect(this.newTransaction).to.not.be.null;
    // Set
    const transactionId = this.newTransaction.id;
    this.transactionStartTime = moment().subtract(1, 'h').toDate();
    // Clear old one
    this.newTransaction = null;
    // Start the 2nd Transaction
    const startTransactionResponse = await this.chargingStationContext.startTransaction(
      this.chargingStationConnector1.connectorId,
      this.transactionStartUser.tags[0].id,
      this.energyActiveImportStartMeterValue,
      this.transactionStartTime
    );
    const secondTransactionId = startTransactionResponse.transactionId;
    await this.validateStartedTransaction(
      startTransactionResponse,
      this.chargingStationConnector1,
      this.energyActiveImportStartMeterValue,
      this.transactionStartTime);
    // Check if the Transaction exists
    this.newTransaction = (await this.centralUserService.transactionApi.readById(secondTransactionId)).data;
    expect(this.newTransaction).to.not.be.null;
    expect(this.newTransaction.id).to.not.equal(transactionId);
  }

  public async testRemoteStartTransactionWithNoBadge(): Promise<void> {
    const response = await this.centralUserService.chargingStationApi.remoteStartTransaction({
      'chargingStationID': this.chargingStationContext.getChargingStation().id,
      'args': {
        'connectorId': this.chargingStationContext.getChargingStation().connectors[0].connectorId
      }
    });
    expect(response.status).to.equal(StatusCodes.BAD_REQUEST);
  }

  public async testRemoteStartTransactionWithExternalUser(): Promise<void> {
    const response = await this.centralUserService.chargingStationApi.remoteStartTransaction({
      'chargingStationID': this.chargingStationContext.getChargingStation().id,
      'args': {
        'visualTagID': this.transactionStartUser.tags[0].visualID,
        'connectorId': this.chargingStationContext.getChargingStation().connectors[0].connectorId,
        'userID': this.transactionStartUser.id
      }
    });
    expect(response.status).to.equal(StatusCodes.INTERNAL_SERVER_ERROR);
  }

  public async testRemoteStartTransactionWithUnassignedChargingStation() {
    const response = await this.centralUserService.chargingStationApi.remoteStartTransaction({
      'chargingStationID': this.chargingStationContext.getChargingStation().id,
      'args': {
        'visualTagID': this.transactionStartUser.tags[0].visualID,
        'connectorId': this.chargingStationContext.getChargingStation().connectors[0].connectorId,
        'userID': this.transactionStartUser.id
      }
    });
    expect(response.status).to.equal(StatusCodes.INTERNAL_SERVER_ERROR);
  }


  public async testSendMeterValues(withSoC = false, withSignedData = false, withOnlyEndSignedData = false): Promise<void> {
  // Check on Transaction
    expect(this.newTransaction).to.not.be.null;
    // Current Time matches Transaction one
    this.transactionCurrentTime = moment(this.newTransaction.timestamp).toDate();
    // Start Meter Value matches Transaction one
    let currentEnergyActiveImportMeterValue = this.energyActiveImportStartMeterValue;
    // ------------------------------------------------------------------
    // Send Transaction.Begin
    // ------------------------------------------------------------------
    let meterValueResponse = await this.chargingStationContext.sendBeginMeterValue(
      this.newTransaction.connectorId,
      this.newTransaction.id,
      this.transactionCurrentTime,
      {
        energyActiveImportMeterValue: this.energyActiveImportStartMeterValue,
        socMeterValue: withSoC ? this.socMeterValues[0] : 0,
        powerImportMeterValue: this.powerImportMeterValues[0],
        voltageMeterValue: this.voltageMeterValues[0],
        voltageL1MeterValue: this.voltageL1MeterValues[0],
        voltageL2MeterValue: this.voltageL2MeterValues[0],
        voltageL3MeterValue: this.voltageL3MeterValues[0],
        amperageMeterValue: this.amperageMeterValues[0],
        amperageL1MeterValue: this.amperageL1MeterValues[0],
        amperageL2MeterValue: this.amperageL2MeterValues[0],
        amperageL3MeterValue: this.amperageL3MeterValues[0],
        signedDataStartMeterValue: (withSignedData && !withOnlyEndSignedData) ? this.transactionStartSignedData : null,
      }
    );
    if (meterValueResponse) {
      expect(meterValueResponse).to.eql({});
    }
    // Check Transaction
    let transactionValidation = await this.basicTransactionValidation(this.newTransaction.id,
      this.newTransaction.connectorId, this.newTransaction.meterStart, this.newTransaction.timestamp);
    // ------------------------------------------------------------------
    // Send Meter Values (except the last one which is used in Stop Transaction)
    // ------------------------------------------------------------------
    let currentCumulatedPrice = 0;
    for (let index = 0; index <= this.energyActiveImportMeterValues.length - 2; index++) {
      // Set new meter value
      currentCumulatedPrice = Utils.createDecimal(currentCumulatedPrice).plus(
        Utils.computeSimplePrice(ContextDefinition.DEFAULT_PRICE, this.energyActiveImportMeterValues[index])).toNumber();
      if (index === this.energyActiveImportMeterValues.length - 2) {
        this.totalPrice = currentCumulatedPrice;
      }
      currentEnergyActiveImportMeterValue += this.energyActiveImportMeterValues[index];
      // Add time
      this.transactionCurrentTime = moment(this.transactionCurrentTime).add(this.meterValueIntervalSecs, 's').toDate();
      // Send consumption meter value
      meterValueResponse = await this.chargingStationContext.sendConsumptionMeterValue(
        this.newTransaction.connectorId,
        this.newTransaction.id,
        this.transactionCurrentTime,
        {
          energyActiveImportMeterValue: currentEnergyActiveImportMeterValue,
          powerImportMeterValue: this.powerImportMeterValues[index],
          powerImportL1MeterValue: this.powerImportL1MeterValues[index],
          powerImportL2MeterValue: this.powerImportL2MeterValues[index],
          powerImportL3MeterValue: this.powerImportL3MeterValues[index],
          voltageMeterValue: this.voltageMeterValues[index],
          voltageL1MeterValue: this.voltageL1MeterValues[index],
          voltageL2MeterValue: this.voltageL2MeterValues[index],
          voltageL3MeterValue: this.voltageL3MeterValues[index],
          amperageMeterValue: this.amperageMeterValues[index],
          amperageL1MeterValue: this.amperageL1MeterValues[index],
          amperageL2MeterValue: this.amperageL2MeterValues[index],
          amperageL3MeterValue: this.amperageL3MeterValues[index],
          socMeterValue: withSoC ? this.socMeterValues[index] : 0,
        }
      );
      expect(meterValueResponse).to.eql({});
      // Check the Consumption
      if (this.chargingStationContext.getChargingStation().ocppVersion === OCPPVersion.VERSION_15) {
        transactionValidation = await this.basicTransactionValidation(this.newTransaction.id,
          this.newTransaction.connectorId, this.newTransaction.meterStart, this.newTransaction.timestamp);
        expect(transactionValidation.data).to.deep.include({
          currentInstantWatts: this.energyActiveImportMeterValues[index] * (3600 / this.meterValueIntervalSecs),
          currentTotalConsumptionWh: (currentEnergyActiveImportMeterValue - this.energyActiveImportStartMeterValue),
          currentTotalDurationSecs: this.meterValueIntervalSecs * (index + 1),
          currentTotalInactivitySecs: this.totalInactivities[index],
          currentInactivityStatus: Utils.getInactivityStatusLevel(this.chargingStationContext.getChargingStation(),
            this.newTransaction.connectorId, this.totalInactivities[index]),
        });
      } else {
        transactionValidation = await this.basicTransactionValidation(this.newTransaction.id,
          this.newTransaction.connectorId, this.newTransaction.meterStart, this.newTransaction.timestamp);
        expect(transactionValidation.data).to.deep.include({
          currentInstantWatts: this.powerImportMeterValues[index],
          currentTotalConsumptionWh: (currentEnergyActiveImportMeterValue - this.energyActiveImportStartMeterValue),
          currentTotalDurationSecs: this.meterValueIntervalSecs * (index + 1),
          currentTotalInactivitySecs: this.totalInactivities[index],
          currentInactivityStatus: Utils.getInactivityStatusLevel(this.chargingStationContext.getChargingStation(),
            this.newTransaction.connectorId, this.totalInactivities[index]),
        });
      }
      assert(transactionValidation.data.currentCumulatedPrice === currentCumulatedPrice, `The cumulated price should be: ${currentCumulatedPrice} - actual value is: ` + transactionValidation.data.currentCumulatedPrice + ' for transaction: ' + this.newTransaction.id);
      if (withSoC) {
        expect(transactionValidation.data).to.deep.include({
          currentStateOfCharge: this.socMeterValues[index]
        });
      } else {
        expect(transactionValidation.data).to.deep.include({
          stateOfCharge: this.newTransaction.stateOfCharge
        });
      }
    }
    // ------------------------------------------------------------------
    // Send Transaction.End
    // ------------------------------------------------------------------
    meterValueResponse = await this.chargingStationContext.sendEndMeterValue(
      this.newTransaction.connectorId,
      this.newTransaction.id,
      moment(this.transactionCurrentTime).toDate(),
      {
        energyActiveImportMeterValue: this.energyActiveImportEndMeterValue,
        powerImportMeterValue: this.powerImportMeterValues[this.powerImportMeterValues.length - 1],
        voltageMeterValue: this.voltageMeterValues[this.voltageMeterValues.length - 1],
        voltageL1MeterValue: this.voltageL1MeterValues[this.voltageL1MeterValues.length - 1],
        voltageL2MeterValue: this.voltageL2MeterValues[this.voltageL2MeterValues.length - 1],
        voltageL3MeterValue: this.voltageL3MeterValues[this.voltageL3MeterValues.length - 1],
        amperageMeterValue: this.amperageMeterValues[this.amperageMeterValues.length - 1],
        amperageL1MeterValue: this.amperageL1MeterValues[this.amperageL1MeterValues.length - 1],
        amperageL2MeterValue: this.amperageL2MeterValues[this.amperageL2MeterValues.length - 1],
        amperageL3MeterValue: this.amperageL3MeterValues[this.amperageL3MeterValues.length - 1],
        socMeterValue: withSoC ? this.socMeterValues[this.socMeterValues.length - 1] : 0,
        signedDataStartMeterValue: withSignedData ? this.transactionStartSignedData : null,
        signedDataStopMeterValue: withSignedData ? this.transactionEndSignedData : null,
      }
    );
    if (meterValueResponse) {
      expect(meterValueResponse).to.eql({});
    }
    // Check the Transaction End
    transactionValidation = await this.basicTransactionValidation(this.newTransaction.id,
      this.newTransaction.connectorId, this.newTransaction.meterStart, this.newTransaction.timestamp);
    if (withSoC) {
      expect(transactionValidation.data).to.deep.include({
        currentStateOfCharge: this.socMeterValues[this.socMeterValues.length - 1]
      });
    } else {
      expect(transactionValidation.data).to.deep.include({
        stateOfCharge: this.newTransaction.stateOfCharge
      });
    }
  }

  public async testStopTransaction(withSoC = false, withSignedData = false): Promise<void> {
    // Check on Transaction
    expect(this.newTransaction).to.not.be.null;
    expect(this.transactionCurrentTime).to.not.be.null;
    // Set end time
    this.transactionCurrentTime = moment(this.transactionCurrentTime).add(this.meterValueIntervalSecs, 's').toDate();
    // Stop the Transaction
    const stopTransactionResponse = await this.chargingStationContext.stopTransaction(this.newTransaction.id,
      this.transactionStopUser.tags[0].id, this.energyActiveImportEndMeterValue, this.transactionCurrentTime);
    expect(stopTransactionResponse).to.have.property('idTagInfo');
    expect(stopTransactionResponse.idTagInfo.status).to.equal(OCPPStatus.ACCEPTED);
    // Set the connector to Available
    this.chargingStationConnector1.status = ChargePointStatus.AVAILABLE;
    this.chargingStationConnector1.timestamp = this.transactionCurrentTime.toISOString();
    // Update
    const statusResponse = await this.chargingStationContext.setConnectorStatus(this.chargingStationConnector1);
    expect(statusResponse).to.eql({});
    // Check the Transaction
    const transactionValidation = await this.basicTransactionValidation(this.newTransaction.id,
      this.newTransaction.connectorId, this.newTransaction.meterStart, this.newTransaction.timestamp);
    expect(transactionValidation.data).to.deep['containSubset']({
      signedData: (withSignedData ? this.transactionStartSignedData : ''),
      stop: {
        meterStop: this.energyActiveImportEndMeterValue,
        totalConsumptionWh: this.transactionTotalConsumptionWh,
        totalInactivitySecs: this.transactionTotalInactivitySecs,
        inactivityStatus: InactivityStatus.INFO,
        totalDurationSecs: moment.duration(moment(this.transactionCurrentTime).diff(this.newTransaction.timestamp)).asSeconds(),
        tagID: this.transactionStopUser.tags[0].id,
        timestamp: this.transactionCurrentTime.toISOString(),
        signedData: (withSignedData ? this.transactionEndSignedData : ''),
        stateOfCharge: (withSoC ? this.socMeterValues[this.socMeterValues.length - 1] : 0),
        user: {
          id: this.transactionStopUser.id,
          name: this.transactionStopUser.name,
          firstName: this.transactionStopUser.firstName
        }
      }
    });
    // Check priced data
    const totalTransactionPrice = Utils.computeSimplePrice(ContextDefinition.DEFAULT_PRICE, this.transactionTotalConsumptionWh);
    assert(Utils.createDecimal(this.totalPrice).equals(totalTransactionPrice), `The total transaction price should be: ${totalTransactionPrice} - actual value is: ${this.totalPrice}`);
    // Check STOP priced data
    this.checkPricedTransactionData(transactionValidation.data);
  }

  public async testTransactionMetrics(withSoC = false, checkNewMeterValues = false): Promise<void> {
    // Check on Transaction
    expect(this.newTransaction).to.not.be.null;
    const response = await this.centralUserService.transactionApi.readAllConsumption({ TransactionId: this.newTransaction.id });
    expect(response.status).to.equal(StatusCodes.OK);
    // Check Headers
    expect(response.data).to.deep['containSubset']({
      chargeBoxID: this.newTransaction.chargeBoxID,
      connectorId: this.newTransaction.connectorId,
      stop: {
        tagID: this.transactionStopUser.tags[0].id,
        totalConsumptionWh: this.transactionTotalConsumptionWh,
        totalInactivitySecs: this.transactionTotalInactivitySecs,
        inactivityStatus: InactivityStatus.INFO,
        stateOfCharge: (withSoC ? this.socMeterValues[this.socMeterValues.length - 1] : 0),
        user: {
          id: this.transactionStopUser.id,
          name: this.transactionStopUser.name,
          firstName: this.transactionStopUser.firstName
        }
      },
      id: this.newTransaction.id,
      user: {
        id: this.transactionStartUser.id,
        name: this.transactionStartUser.name,
        firstName: this.transactionStartUser.firstName
      }
    });
    // Check priced data
    const totalTransactionPrice = Utils.computeSimplePrice(ContextDefinition.DEFAULT_PRICE, this.transactionTotalConsumptionWh);
    assert(this.totalPrice === totalTransactionPrice, `The total transaction price should be: ${totalTransactionPrice} - actual value is: ${this.totalPrice}`);
    // Check STOP priced data
    this.checkPricedTransactionData(response.data);
    // Init
    const transactionCurrentTime = moment(this.newTransaction.timestamp);
    let transactionCumulatedConsumption = this.energyActiveImportStartMeterValue;
    // Check Consumption
    for (let i = 0; i < response.data.values.length - 1; i++) {
      // Get the value
      const value = response.data.values[i];
      // Sum
      transactionCumulatedConsumption += this.energyActiveImportMeterValues[i];
      if (this.chargingStationContext.getChargingStation().ocppVersion === OCPPVersion.VERSION_15) {
        const instantWatts = this.energyActiveImportMeterValues[i] * (3600 / this.meterValueIntervalSecs);
        expect(value).to.include({
          'startedAt': transactionCurrentTime.toISOString(),
          'instantAmps': Utils.convertWattToAmp(this.chargingStationContext.getChargingStation(),
            null, this.newTransaction.connectorId, instantWatts),
          'instantWatts': instantWatts,
          'cumulatedConsumptionWh': transactionCumulatedConsumption,
          'cumulatedConsumptionAmps': Utils.convertWattToAmp(this.chargingStationContext.getChargingStation(),
            null, this.newTransaction.connectorId, transactionCumulatedConsumption)
        });
        if (withSoC) {
          expect(value).to.include({
            'stateOfCharge': this.socMeterValues[i]
          });
        }
      } else {
        expect(value).to.include({
          'startedAt': transactionCurrentTime.toISOString(),
          'instantVolts': checkNewMeterValues ? this.voltageMeterValues[i] : 0,
          'instantVoltsL1': checkNewMeterValues ? this.voltageL1MeterValues[i] : 0,
          'instantVoltsL2': checkNewMeterValues ? this.voltageL2MeterValues[i] : 0,
          'instantVoltsL3': checkNewMeterValues ? this.voltageL3MeterValues[i] : 0,
          'instantAmps': checkNewMeterValues ? this.amperageMeterValues[i] :
            Utils.convertWattToAmp(this.chargingStationContext.getChargingStation(),
              null, this.newTransaction.connectorId, this.powerImportMeterValues[i]),
          'instantAmpsL1': checkNewMeterValues ? this.amperageL1MeterValues[i] : 0,
          'instantAmpsL2': checkNewMeterValues ? this.amperageL2MeterValues[i] : 0,
          'instantAmpsL3': checkNewMeterValues ? this.amperageL3MeterValues[i] : 0,
          'instantWatts': this.powerImportMeterValues[i],
          'instantWattsL1': checkNewMeterValues ? this.voltageL1MeterValues[i] * this.amperageL1MeterValues[i] : 0,
          'instantWattsL2': checkNewMeterValues ? this.voltageL2MeterValues[i] * this.amperageL2MeterValues[i] : 0,
          'instantWattsL3': checkNewMeterValues ? this.voltageL3MeterValues[i] * this.amperageL3MeterValues[i] : 0,
          'cumulatedConsumptionWh': transactionCumulatedConsumption,
          'cumulatedConsumptionAmps': Utils.convertWattToAmp(this.chargingStationContext.getChargingStation(),
            null, this.newTransaction.connectorId, transactionCumulatedConsumption)
        });
      }
      // Add time
      transactionCurrentTime.add(this.meterValueIntervalSecs, 's');
    }
  }

  public async testDeleteTransaction(noAuthorization = false): Promise<void> {
    // Delete the created entity
    expect(this.newTransaction).to.not.be.null;
    let response = await this.transactionStartUserService.transactionApi.delete(this.newTransaction.id);
    if (noAuthorization) {
      expect(response.status).to.equal(StatusCodes.FORBIDDEN);
      // Transaction must be deleted by Admin user
      response = await this.centralUserService.transactionApi.delete(this.newTransaction.id);
    }
    // Remove from transactions to be deleted
    this.chargingStationContext.removeTransaction(this.newTransaction.id);
    expect(response.status).to.equal(StatusCodes.OK);
    expect(response.data).to.have.property('status');
    expect(response.data.status).to.be.eql('Success');
    this.newTransaction = null;
  }

  public async testAuthorizeTagAsInteger(): Promise<void> {
    await this.testAuthorize(this.numberTag, OCPPStatus.ACCEPTED);
    await this.testAuthorize(this.numberTag.toString(), OCPPStatus.ACCEPTED);
  }

  public async testAuthorizeInvalidTag(): Promise<void> {
    await this.testAuthorize(this.invalidTag, OCPPAuthorizationStatus.INVALID);
    await this.testAuthorize('', OCPPAuthorizationStatus.INVALID);
    await this.testAuthorize(null, OCPPAuthorizationStatus.INVALID);
  }

  public async testStartTransactionWithConnectorIdAsString(): Promise<void> {
    const response = await this.chargingStationContext.startTransaction(
      this.chargingStationConnector1.connectorId,
      this.numberTag.toString(),
      0,
      this.transactionStartTime
    );
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(response).to.be.transactionValid;
  }

  public async testStartTransactionWithMeterStartGreaterZero(): Promise<void> {
    const response = await this.chargingStationContext.startTransaction(
      this.chargingStationConnector1.connectorId,
      this.numberTag.toString(),
      faker.datatype.number(100000),
      this.transactionStartTime
    );
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(response).to.be.transactionValid;
  }

  public async testStartTransactionWithInvalidTag(): Promise<void> {
    let response = await this.chargingStationContext.startTransaction(
      this.chargingStationConnector1.connectorId,
      this.invalidTag,
      0,
      this.transactionStartTime
    );
    expect(response).to.be.transactionStatus(OCPPAuthorizationStatus.INVALID);
    response = await this.chargingStationContext.startTransaction(
      this.chargingStationConnector1.connectorId,
      '',
      0,
      this.transactionStartTime
    );
    expect(response).to.be.transactionStatus(OCPPAuthorizationStatus.INVALID);
    response = await this.chargingStationContext.startTransaction(
      this.chargingStationConnector1.connectorId,
      null,
      0,
      this.transactionStartTime
    );
    expect(response).to.be.transactionStatus(OCPPAuthorizationStatus.INVALID);
  }

  public async testStopTransactionWithoutTransactionData(): Promise<void> {
    const startTransactionResponse = await this.chargingStationContext.startTransaction(
      this.chargingStationConnector1.connectorId,
      this.numberTag.toString(),
      this.energyActiveImportStartMeterValue,
      this.transactionStartTime
    );
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(startTransactionResponse).to.be.transactionValid;
    const transactionId = startTransactionResponse.transactionId;
    this.transactionCurrentTime = moment().toDate();
    const stopValue = this.energyActiveImportStartMeterValue + faker.datatype.number(100000);
    const stopTransactionResponse = await this.chargingStationContext.stopTransaction(
      transactionId, this.numberTag.toString(), stopValue, this.transactionCurrentTime);
    expect(stopTransactionResponse).to.have.property('idTagInfo');
    expect(stopTransactionResponse.idTagInfo.status).to.equal(OCPPStatus.ACCEPTED);
  }

  public async testStopTransactionWithTransactionData(): Promise<void> {
    const startTransactionResponse = await this.chargingStationContext.startTransaction(
      this.chargingStationConnector1.connectorId,
      this.numberTag.toString(),
      this.energyActiveImportStartMeterValue,
      this.transactionStartTime
    );
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(startTransactionResponse).to.be.transactionValid;
    const transactionId = startTransactionResponse.transactionId;
    this.transactionCurrentTime = moment().toDate();
    const stopValue = this.energyActiveImportStartMeterValue + faker.datatype.number(100000);
    let transactionData: OCPPMeterValue[] | OCPP15TransactionData;
    if (this.chargingStationContext.getChargingStation().ocppVersion === OCPPVersion.VERSION_16) {
      transactionData = [
        {
          'timestamp': this.transactionStartTime.toISOString(),
          'sampledValue': [
            {
              'value': this.energyActiveImportStartMeterValue.toString(),
              ...Constants.OCPP_ENERGY_ACTIVE_IMPORT_REGISTER_ATTRIBUTE,
              'context': OCPPReadingContext.TRANSACTION_BEGIN,
            }
          ]
        },
        {
          'timestamp': this.transactionCurrentTime.toISOString(),
          'sampledValue': [
            {
              'value': stopValue.toString(),
              ...Constants.OCPP_ENERGY_ACTIVE_IMPORT_REGISTER_ATTRIBUTE,
              'context': OCPPReadingContext.TRANSACTION_END,
            }
          ]
        }
      ];
    // OCPP 1.5
    } else {
      transactionData = {
        'values': [
          {
            'timestamp': this.transactionStartTime.toISOString(),
            'value': {
              '$attributes': {
                ...Constants.OCPP_ENERGY_ACTIVE_IMPORT_REGISTER_ATTRIBUTE,
                'context': OCPPReadingContext.TRANSACTION_BEGIN,
              },
              '$value': this.energyActiveImportStartMeterValue.toString(),
            }
          },
          {
            'timestamp': this.transactionCurrentTime.toISOString(),
            'value': {
              '$attributes': {
                ...Constants.OCPP_ENERGY_ACTIVE_IMPORT_REGISTER_ATTRIBUTE,
                'context': OCPPReadingContext.TRANSACTION_END,
              },
              '$value': stopValue.toString()
            }
          }
        ]
      };
    }
    const stopTransactionResponse = await this.chargingStationContext.stopTransaction(transactionId, this.numberTag.toString(), stopValue, this.transactionCurrentTime, transactionData);
    expect(stopTransactionResponse).to.have.property('idTagInfo');
    expect(stopTransactionResponse.idTagInfo.status).to.equal(OCPPStatus.ACCEPTED);
  }

  public async testStopTransactionWithInvalidTransactionData(): Promise<void> {
    const startTransactionResponse = await this.chargingStationContext.startTransaction(
      this.chargingStationConnector1.connectorId,
      this.numberTag.toString(),
      this.energyActiveImportStartMeterValue,
      this.transactionStartTime
    );
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(startTransactionResponse).to.be.transactionValid;
    const transactionId = startTransactionResponse.transactionId;
    this.transactionCurrentTime = moment().toDate();
    const stopValue = this.energyActiveImportStartMeterValue + faker.datatype.number(100000);
    let transactionData: OCPPMeterValue[] | OCPP15TransactionData;
    // Provide TransactionData for wrong OCPP Version
    if (this.chargingStationContext.getChargingStation().ocppVersion === OCPPVersion.VERSION_15) {
      transactionData = [
        {
          'timestamp': this.transactionStartTime.toISOString(),
          'sampledValue': [
            {
              'value': this.energyActiveImportStartMeterValue.toString(),
              ...Constants.OCPP_ENERGY_ACTIVE_IMPORT_REGISTER_ATTRIBUTE,
              'context': OCPPReadingContext.TRANSACTION_BEGIN,
            }
          ]
        },
        {
          'timestamp': this.transactionCurrentTime.toISOString(),
          'sampledValue': [
            {
              'value': stopValue.toString(),
              ...Constants.OCPP_ENERGY_ACTIVE_IMPORT_REGISTER_ATTRIBUTE,
              'context': OCPPReadingContext.TRANSACTION_END,
            }
          ]
        }
      ];
    // OCPP 1.5
    } else {
      transactionData = {
        'values': [
          {
            'timestamp': this.transactionStartTime.toISOString(),
            'value': {
              '$attributes': {
                ...Constants.OCPP_ENERGY_ACTIVE_IMPORT_REGISTER_ATTRIBUTE,
                'context': OCPPReadingContext.TRANSACTION_BEGIN,
              },
              '$value': this.energyActiveImportStartMeterValue.toString(),
            }
          },
          {
            'timestamp': this.transactionCurrentTime.toISOString(),
            'value': {
              '$attributes': {
                ...Constants.OCPP_ENERGY_ACTIVE_IMPORT_REGISTER_ATTRIBUTE,
                'context': OCPPReadingContext.TRANSACTION_END,
              },
              '$value': stopValue.toString()
            }
          }
        ]
      };
    }
    let stopTransactionResponse = await this.chargingStationContext.stopTransaction(transactionId, this.numberTag.toString(), stopValue, this.transactionCurrentTime, transactionData);
    expect(stopTransactionResponse).to.have.property('idTagInfo');
    expect(stopTransactionResponse.idTagInfo.status).to.equal(OCPPAuthorizationStatus.INVALID);
    // Now stop the transaction without Transaction Data
    stopTransactionResponse = await this.chargingStationContext.stopTransaction(transactionId, this.numberTag.toString(), stopValue, this.transactionCurrentTime);
    expect(stopTransactionResponse).to.have.property('idTagInfo');
    expect(stopTransactionResponse.idTagInfo.status).to.equal(OCPPStatus.ACCEPTED);
  }

  public async testRetrieveLastRebootDate(): Promise<void> {
    const bootNotification = await this.chargingStationContext.sendBootNotification();
    expect(bootNotification).to.not.be.null;
    expect(bootNotification.status).to.eql(OCPPStatus.ACCEPTED);
    expect(bootNotification).to.have.property('currentTime');
    let chargingStationResponse = await this.chargingStationContext.readChargingStation();
    if (this.chargingStationContext.getChargingStation().ocppVersion === OCPPVersion.VERSION_16) {
      expect(bootNotification.currentTime).to.equal(chargingStationResponse.data.lastReboot);
    } else {
      expect((bootNotification.currentTime as unknown as Date).toISOString()).to.equal(chargingStationResponse.data.lastReboot);
    }
    const bootNotification2 = await this.chargingStationContext.sendBootNotification();
    chargingStationResponse = await this.chargingStationContext.readChargingStation();
    if (this.chargingStationContext.getChargingStation().ocppVersion === OCPPVersion.VERSION_16) {
      expect(bootNotification2.currentTime).to.equal(chargingStationResponse.data.lastReboot);
    } else {
      expect((bootNotification2.currentTime as unknown as Date).toISOString()).to.equal(chargingStationResponse.data.lastReboot);
    }
    expect(bootNotification.currentTime).to.not.equal(bootNotification2.currentTime);
    if (this.chargingStationContext.getChargingStation().ocppVersion === OCPPVersion.VERSION_16) {
      expect(new Date(bootNotification.currentTime)).to.beforeTime(new Date(bootNotification2.currentTime));
    } else {
      expect(bootNotification.currentTime).to.beforeTime(new Date(bootNotification2.currentTime));
    }
    // Boot notification empty the connectors
    // Send status notifications
    for (const connector of this.chargingStationContext.getChargingStation().connectors) {
      await this.chargingStationContext.setConnectorStatus({
        connectorId: connector.connectorId,
        status: ChargePointStatus.AVAILABLE,
        errorCode: ChargePointErrorCode.NO_ERROR,
        timestamp: new Date().toISOString()
      });
    }
    // Wait for both status notification to be processed
    await Utils.sleep(2000);
    // Check Connectors are recreated
    chargingStationResponse = await this.chargingStationContext.readChargingStation();
    expect(chargingStationResponse.data.connectors.length).to.equal(this.chargingStationContext.getChargingStation().connectors.length);
    // Check they are all available
    for (const connector of chargingStationResponse.data.connectors) {
      expect(connector.status).to.eql(ChargePointStatus.AVAILABLE);
    }
  }

  public async testTransactionIgnoringClockMeterValues(): Promise<void> {
    const meterStart = 0;
    let meterValue = meterStart;
    const currentTime = moment();
    const startTransactionResponse = await this.chargingStationContext.startTransaction(
      this.chargingStationConnector1.connectorId,
      this.numberTag.toString(),
      meterValue,
      currentTime.toDate()
    );
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(startTransactionResponse).to.be.transactionValid;
    const transactionId = startTransactionResponse.transactionId;
    meterValue += 300;
    let meterValueResponse = await this.chargingStationContext.sendConsumptionMeterValue(
      this.chargingStationConnector1.connectorId,
      transactionId,
      currentTime.add(1, 'minute').clone().toDate(),
      { energyActiveImportMeterValue: meterValue }
    );
    expect(meterValueResponse).to.eql({});
    meterValue += 300;
    meterValueResponse = await this.chargingStationContext.sendConsumptionMeterValue(
      this.chargingStationConnector1.connectorId,
      transactionId,
      currentTime.add(1, 'minute').clone().toDate(),
      { energyActiveImportMeterValue: meterValue }
    );
    expect(meterValueResponse).to.eql({});
    meterValue += 300;
    meterValueResponse = await this.chargingStationContext.sendConsumptionMeterValue(
      this.chargingStationConnector1.connectorId,
      transactionId,
      currentTime.add(1, 'minute').clone().toDate(),
      { energyActiveImportMeterValue: meterValue }
    );
    expect(meterValueResponse).to.eql({});
    meterValueResponse = await this.chargingStationContext.sendClockMeterValue(
      this.chargingStationConnector1.connectorId,
      transactionId,
      currentTime.clone().toDate(),
      0
    );
    expect(meterValueResponse).to.eql({});
    meterValue += 300;
    meterValueResponse = await this.chargingStationContext.sendConsumptionMeterValue(
      this.chargingStationConnector1.connectorId,
      transactionId,
      currentTime.add(1, 'minute').clone().toDate(),
      { energyActiveImportMeterValue: meterValue }
    );
    expect(meterValueResponse).to.eql({});
    const stopTransactionResponse = await this.chargingStationContext.stopTransaction(
      transactionId,
      this.numberTag.toString(),
      meterValue, currentTime.add(1, 'minute').clone().toDate()
    );
    expect(stopTransactionResponse).to.have.property('idTagInfo');
    expect(stopTransactionResponse.idTagInfo.status).to.equal(OCPPStatus.ACCEPTED);
    const transaction = await this.centralUserService.transactionApi.readById(transactionId);
    expect(transaction.status).to.equal(StatusCodes.OK);
    expect(transaction.data).to.deep['containSubset']({
      id: transactionId,
      meterStart: meterStart,
      stop: {
        totalConsumptionWh: meterValue - meterStart,
        totalInactivitySecs: 60,
        inactivityStatus: InactivityStatus.INFO
      }
    });
  }

  private async createUser(user = Factory.user.build()) {
    const createdUser = await this.centralUserService.createEntity(this.centralUserService.userApi, user);
    return createdUser;
  }

  private async createTag(tag: Tag) {
    const createdTag = await this.centralUserService.tagApi.createTag(tag);
    return createdTag;
  }

  private async testAuthorize(tagId, expectedStatus) {
    const response = await this.chargingStationContext.authorize(tagId);
    expect(response).to.have.property('idTagInfo');
    expect(response.idTagInfo.status).to.equal(expectedStatus);
  }

  private async validateStartedTransaction(response, chargingStationConnector, startMeterValue, startTime) {
    expect(response).to.have.property('idTagInfo');
    expect(response.idTagInfo.status).to.equal(OCPPStatus.ACCEPTED);
    expect(response).to.have.property('transactionId');
    expect(response.transactionId).to.not.equal(0);
    const transactionId = response.transactionId;
    // Update connector status
    chargingStationConnector.status = ChargePointStatus.OCCUPIED;
    chargingStationConnector.timestamp = new Date().toISOString();
    const statusNotificationResponse = await this.chargingStationContext.setConnectorStatus(chargingStationConnector);
    expect(statusNotificationResponse).to.eql({});
    const basicTransactionValidation = await this.basicTransactionValidation(transactionId, chargingStationConnector.connectorId, startMeterValue, startTime.toISOString());
    expect(basicTransactionValidation.data).to.deep.include({
      currentInstantWatts: 0,
      currentCumulatedPrice: 0,
      currentStateOfCharge: 0,
      currentTotalConsumptionWh: 0,
      currentTotalInactivitySecs: 0,
      currentInactivityStatus: InactivityStatus.INFO,
      price: 0,
      roundedPrice: 0,
    });
  }

  private async basicTransactionValidation(transactionId: number, connectorId: number, meterStart: number, timestamp: Date) {
    const transactionResponse = await this.centralUserService.transactionApi.readById(transactionId);
    expect(transactionResponse.status).to.equal(StatusCodes.OK);
    expect(transactionResponse.data).to.deep['containSubset']({
      id: transactionId,
      timestamp: timestamp,
      chargeBoxID: this.chargingStationContext.getChargingStation().id,
      connectorId: connectorId,
      tagID: this.transactionStartUser.tags[0].id,
      meterStart: meterStart,
      userID: this.transactionStartUser.id,
      siteAreaID: this.chargingStationContext.getChargingStation().siteAreaID,
      siteID: this.chargingStationContext.getChargingStation().siteID,
      user: {
        id: this.transactionStartUser.id,
        name: this.transactionStartUser.name,
        firstName: this.transactionStartUser.firstName
      }
    });
    return transactionResponse;
  }

  private checkPricedTransactionData(data): void {
    assert(data.stop.pricingSource === 'simple', 'The pricing source is not correct');
    const expectedRoundedPrice = Utils.truncTo(this.totalPrice, 2);
    assert(Utils.createDecimal(data.stop.price).equals(this.totalPrice), `The total transaction price should be: ${this.totalPrice} - actual value is: ` + data.stop.price);
    assert(Utils.createDecimal(data.stop.roundedPrice).equals(expectedRoundedPrice), `The total transaction price should be: ${expectedRoundedPrice} - actual value is: ` + data.stop.roundedPrice);
  }
}
