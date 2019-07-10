import chai, { expect } from 'chai';
import chaiDatetime from 'chai-datetime';
import chaiSubset from 'chai-subset';
import faker from 'faker';
// import 'mocha';
import moment from 'moment';
import CentralServerService from './client/CentralServerService';
import DataHelper from './DataHelper';
import Factory from '../factories/Factory';

chai.use(chaiDatetime);
chai.use(chaiSubset);

class TestData {
  public dataHelper: DataHelper;
  public tenantID: string;
  public dataHelper15: DataHelper;
  public validTag: any;
  public invalidTag: any;
  public numberTag: any;
  public defaultUser: any;
  public defaultCompany: any;
  public defaultSite: any;
  public defaultConnectorId: any;
  public defaultMeterStart: any;
  public defaultChargingStation: any;
  public defaultChargingStation15: any;

  async init() {
    this.tenantID = await CentralServerService.DefaultInstance.authenticatedApi.getTenantID();
    this.dataHelper = new DataHelper('1.6', this.tenantID);
    this.dataHelper15 = new DataHelper('1.5', testData.tenantID);
  }
}

const testData = new TestData();

describe('OCPP Validation tests', function() {
  this.timeout(10000);
  before(async () => {
    testData.tenantID = await CentralServerService.DefaultInstance.authenticatedApi.getTenantID();
    testData.dataHelper = new DataHelper('1.6', testData.tenantID);
    testData.dataHelper15 = new DataHelper('1.5', testData.tenantID);

    testData.validTag = faker.random.alphaNumeric(20).toString();
    testData.invalidTag = faker.random.alphaNumeric(21).toString();
    testData.numberTag = faker.random.number(10000);
    testData.defaultUser = await testData.dataHelper.createUser(Factory.user.build({ tagIDs: [testData.validTag, testData.invalidTag, testData.numberTag.toString()] }));

    testData.defaultCompany = await testData.dataHelper.createCompany();
    testData.defaultSite = await testData.dataHelper.createSite(testData.defaultCompany, [testData.defaultUser]);

    testData.defaultConnectorId = 1;
    testData.defaultMeterStart = 0;
    testData.defaultChargingStation = await testData.dataHelper.createChargingStation();
    await testData.dataHelper.createSiteArea(testData.defaultSite, [testData.defaultChargingStation]);

    testData.defaultChargingStation15 = await testData.dataHelper15.createChargingStation();
    await testData.dataHelper15.createSiteArea(testData.defaultSite, [testData.defaultChargingStation15]);
  });

  after(async () => {
    testData.dataHelper.close();
    testData.dataHelper.destroyData();

    testData.dataHelper15.close();
    testData.dataHelper15.destroyData();
  });

  it('Should be possible to authorize a user with tag as integer', async () => {
    await testData.dataHelper.authorize(testData.defaultChargingStation, testData.numberTag);
    await testData.dataHelper.authorize(testData.defaultChargingStation, testData.numberTag.toString());

    await testData.dataHelper15.authorize(testData.defaultChargingStation, testData.numberTag);
    await testData.dataHelper15.authorize(testData.defaultChargingStation, testData.numberTag.toString());
  });

  it('Should not be possible to authorize a user with a invalid tags', async () => {
    await testData.dataHelper.authorize(testData.defaultChargingStation, testData.invalidTag, 'Invalid');
    await testData.dataHelper.authorize(testData.defaultChargingStation, '', 'Invalid');
    await testData.dataHelper.authorize(testData.defaultChargingStation, undefined, 'Invalid');

    await testData.dataHelper15.authorize(testData.defaultChargingStation15, testData.invalidTag, 'Invalid');
    await testData.dataHelper15.authorize(testData.defaultChargingStation15, '', 'Invalid');
    await testData.dataHelper15.authorize(testData.defaultChargingStation15, undefined, 'Invalid');
  });

  it('Should be possible to start a transaction with tag as integer', async () => {
    await testData.dataHelper.startTransaction(testData.defaultChargingStation, testData.defaultConnectorId, testData.numberTag, testData.defaultMeterStart, moment());
    await testData.dataHelper.startTransaction(testData.defaultChargingStation, testData.defaultConnectorId, testData.numberTag.toString(), testData.defaultMeterStart, moment());

    await testData.dataHelper15.startTransaction(testData.defaultChargingStation15, testData.defaultConnectorId, testData.numberTag, testData.defaultMeterStart, moment());
    await testData.dataHelper15.startTransaction(testData.defaultChargingStation15, testData.defaultConnectorId, testData.numberTag.toString(), testData.defaultMeterStart, moment());
  });

  it('Should be possible to start a transaction with connectorId as string', async () => {
    await testData.dataHelper.startTransaction(testData.defaultChargingStation, testData.defaultConnectorId, testData.numberTag, testData.defaultMeterStart, moment());
    await testData.dataHelper.startTransaction(testData.defaultChargingStation, testData.defaultConnectorId.toString(), testData.numberTag.toString(), testData.defaultMeterStart, moment());

    await testData.dataHelper15.startTransaction(testData.defaultChargingStation15, testData.defaultConnectorId, testData.numberTag, testData.defaultMeterStart, moment());
    await testData.dataHelper15.startTransaction(testData.defaultChargingStation15, testData.defaultConnectorId.toString(), testData.numberTag.toString(), testData.defaultMeterStart, moment());
  });

  it('Should be possible to start a transaction with meterStart as string', async () => {
    await testData.dataHelper.startTransaction(testData.defaultChargingStation, testData.defaultConnectorId, testData.numberTag, testData.defaultMeterStart, moment());
    await testData.dataHelper.startTransaction(testData.defaultChargingStation, testData.defaultConnectorId, testData.numberTag.toString(), testData.defaultMeterStart.toString(), moment());

    await testData.dataHelper15.startTransaction(testData.defaultChargingStation15, testData.defaultConnectorId, testData.numberTag, testData.defaultMeterStart, moment());
    await testData.dataHelper15.startTransaction(testData.defaultChargingStation15, testData.defaultConnectorId, testData.numberTag.toString(), testData.defaultMeterStart.toString(), moment());
  });

  it('Should be possible to start a transaction with meterStart greater than 0', async () => {
    await testData.dataHelper.startTransaction(testData.defaultChargingStation, testData.defaultConnectorId, testData.numberTag, faker.random.number(100000), moment());

    await testData.dataHelper15.startTransaction(testData.defaultChargingStation15, testData.defaultConnectorId, testData.numberTag, faker.random.number(100000), moment());
  });

  it('Should not be possible to start a transaction with a invalid tags', async () => {
    await testData.dataHelper.startTransaction(testData.defaultChargingStation, testData.defaultConnectorId, testData.invalidTag, testData.defaultMeterStart, moment(), 'Invalid');
    await testData.dataHelper.startTransaction(testData.defaultChargingStation, testData.defaultConnectorId, '', testData.defaultMeterStart, moment(), 'Invalid');
    await testData.dataHelper.startTransaction(testData.defaultChargingStation, testData.defaultConnectorId, undefined, testData.defaultMeterStart, moment(), 'Invalid');

    await testData.dataHelper15.startTransaction(testData.defaultChargingStation15, testData.defaultConnectorId, testData.invalidTag, testData.defaultMeterStart, moment(), 'Invalid');
    await testData.dataHelper15.startTransaction(testData.defaultChargingStation15, testData.defaultConnectorId, '', testData.defaultMeterStart, moment(), 'Invalid');
    await testData.dataHelper15.startTransaction(testData.defaultChargingStation15, testData.defaultConnectorId, undefined, testData.defaultMeterStart, moment(), 'Invalid');
  });

  it('Should not be possible to start a transaction with invalid connectorId', async () => {
    await testData.dataHelper.startTransaction(testData.defaultChargingStation, 'bla', testData.numberTag, testData.defaultMeterStart, moment(), 'Invalid');
    await testData.dataHelper.startTransaction(testData.defaultChargingStation, '', testData.numberTag.toString(), testData.defaultMeterStart, moment(), 'Invalid');
    await testData.dataHelper.startTransaction(testData.defaultChargingStation, -1, testData.numberTag.toString(), testData.defaultMeterStart, moment(), 'Invalid');
    await testData.dataHelper.startTransaction(testData.defaultChargingStation, undefined, testData.numberTag.toString(), testData.defaultMeterStart, moment(), 'Invalid');

    await testData.dataHelper15.startTransaction(testData.defaultChargingStation15, 'bla', testData.numberTag, testData.defaultMeterStart, moment(), 'Invalid');
    await testData.dataHelper15.startTransaction(testData.defaultChargingStation15, '', testData.numberTag.toString(), testData.defaultMeterStart, moment(), 'Invalid');
    await testData.dataHelper15.startTransaction(testData.defaultChargingStation15, -1, testData.numberTag.toString(), testData.defaultMeterStart, moment(), 'Invalid');
    await testData.dataHelper15.startTransaction(testData.defaultChargingStation15, undefined, testData.numberTag.toString(), testData.defaultMeterStart, moment(), 'Invalid');
  });

  it('Should not be possible to start a transaction with invalid meterStart', async () => {
    await testData.dataHelper.startTransaction(testData.defaultChargingStation, testData.defaultConnectorId, testData.numberTag, 'bla', moment(), 'Invalid');
    await testData.dataHelper.startTransaction(testData.defaultChargingStation, testData.defaultConnectorId, testData.numberTag.toString(), '', moment(), 'Invalid');
    await testData.dataHelper.startTransaction(testData.defaultChargingStation, testData.defaultConnectorId, testData.numberTag.toString(), undefined, moment(), 'Invalid');

    await testData.dataHelper15.startTransaction(testData.defaultChargingStation15, testData.defaultConnectorId, testData.numberTag, 'bla', moment(), 'Invalid');
    await testData.dataHelper15.startTransaction(testData.defaultChargingStation15, testData.defaultConnectorId, testData.numberTag.toString(), '', moment(), 'Invalid');
    await testData.dataHelper15.startTransaction(testData.defaultChargingStation15, testData.defaultConnectorId, testData.numberTag.toString(), undefined, moment(), 'Invalid');
  });

  it('Should be possible to stop a transaction without transactionData', async () => {
    const transacId = await testData.dataHelper.startTransaction(testData.defaultChargingStation, testData.defaultConnectorId, testData.numberTag, testData.defaultMeterStart, moment());
    await testData.dataHelper.stopTransaction(testData.defaultChargingStation, transacId, testData.numberTag, faker.random.number(100000), moment(), []);

    const transacId15 = await testData.dataHelper15.startTransaction(testData.defaultChargingStation15, testData.defaultConnectorId, testData.numberTag, testData.defaultMeterStart, moment());
    await testData.dataHelper15.stopTransaction(testData.defaultChargingStation15, transacId15, testData.numberTag, faker.random.number(100000), moment(), {});
  });

  it('Should be possible to stop a transaction with transactionData', async () => {
    const startDate = moment();
    const transacId = await testData.dataHelper.startTransaction(testData.defaultChargingStation, testData.defaultConnectorId, testData.numberTag, testData.defaultMeterStart, startDate);

    const stopDate = moment();
    const stopValue = faker.random.number(100000);
    const transacData = [
      {
        'timestamp': startDate.toISOString(),
        'sampledValue': [
          {
            'value': testData.defaultMeterStart,
            'context': 'Transaction.Begin',
            'format': 'Raw',
            'measurand': 'Energy.Active.Import.Register',
            'location': 'Outlet',
            'unit': 'Wh'
          }
        ]
      },
      {
        'timestamp': stopDate.toISOString(),
        'sampledValue': [
          {
            'value': stopValue,
            'context': 'Transaction.End',
            'format': 'Raw',
            'measurand': 'Energy.Active.Import.Register',
            'location': 'Outlet',
            'unit': 'Wh'
          }
        ]
      }
    ];

    await testData.dataHelper.stopTransaction(testData.defaultChargingStation, transacId, testData.numberTag, stopValue, stopDate, transacData);

    const startDate15 = moment();
    const transacId15 = await testData.dataHelper15.startTransaction(testData.defaultChargingStation15, testData.defaultConnectorId, testData.numberTag, testData.defaultMeterStart, startDate15);

    const stopDate15 = moment();
    const stopValue15 = faker.random.number(100000);
    const transacData15 = {
      'values': [
        {
          'timestamp': startDate15.toISOString(),
          'value': {
            'attributes': {
              'context': 'Transaction.Begin',
              'format': 'Raw',
              'location': 'Outlet',
              'measurand': 'Energy.Active.Import.Register',
              'unit': 'Wh'
            },
            '$value': testData.defaultMeterStart,
          }
        },
        {
          'timestamp': stopDate15.toISOString(),
          'value': {
            'attributes': {
              'context': 'Transaction.End',
              'format': 'Raw',
              'location': 'Outlet',
              'measurand': 'Energy.Active.Import.Register',
              'unit': 'Wh'
            },
            '$value': stopValue15
          }
        }
      ]
    };
    await testData.dataHelper15.stopTransaction(testData.defaultChargingStation15, transacId15, testData.numberTag, stopValue15, stopDate15, transacData15);
  });

  it('Should not be possible to stop a transaction with invalid transactionData', async () => {
    const startDate = moment();
    const stopDate = moment();
    const stopValue = faker.random.number(100000);
    const transacData = [
      {
        'timestamp': startDate.toISOString(),
        'sampledValue': [
          {
            'value': testData.defaultMeterStart,
            'context': 'Transaction.Begin',
            'format': 'Raw',
            'measurand': 'Energy.Active.Import.Register',
            'location': 'Outlet',
            'unit': 'Wh'
          }
        ]
      },
      {
        'timestamp': stopDate.toISOString(),
        'sampledValue': [
          {
            'value': stopValue,
            'context': 'Transaction.End',
            'format': 'Raw',
            'measurand': 'Energy.Active.Import.Register',
            'location': 'Outlet',
            'unit': 'Wh'
          }
        ]
      }
    ];

    const startDate15 = moment();
    const stopDate15 = moment();
    const stopValue15 = faker.random.number(100000);
    const transacData15 = {
      'values': [
        {
          'timestamp': startDate15.toISOString(),
          'value': {
            'attributes': {
              'context': 'Transaction.Begin',
              'format': 'Raw',
              'location': 'Outlet',
              'measurand': 'Energy.Active.Import.Register',
              'unit': 'Wh'
            },
            '$value': testData.defaultMeterStart,
          }
        },
        {
          'timestamp': stopDate15.toISOString(),
          'value': {
            'attributes': {
              'context': 'Transaction.End',
              'format': 'Raw',
              'location': 'Outlet',
              'measurand': 'Energy.Active.Import.Register',
              'unit': 'Wh'
            },
            '$value': stopValue15
          }
        }
      ]
    };

    const transacId = await testData.dataHelper.startTransaction(testData.defaultChargingStation, testData.defaultConnectorId, testData.numberTag, testData.defaultMeterStart, startDate);

    await testData.dataHelper.stopTransaction(testData.defaultChargingStation, transacId, testData.numberTag, stopValue, stopDate, transacData15, 'Invalid');

    await testData.dataHelper.stopTransaction(testData.defaultChargingStation, transacId, testData.numberTag, stopValue, stopDate, []);

    const transacId15 = await testData.dataHelper15.startTransaction(testData.defaultChargingStation15, testData.defaultConnectorId, testData.numberTag, testData.defaultMeterStart, startDate15);

    await testData.dataHelper15.stopTransaction(testData.defaultChargingStation15, transacId15, testData.numberTag, stopValue15, stopDate15, transacData, 'Invalid');

    await testData.dataHelper.stopTransaction(testData.defaultChargingStation15, transacId15, testData.numberTag, stopValue15, stopDate15, {});
  });

  it('Should be possible to retrieve the last reboot date', async () => {
    const bootNotification = await testData.dataHelper.sendBootNotification(testData.defaultChargingStation);
    let chargingStationResponse = await testData.dataHelper.getChargingStation(testData.defaultChargingStation, false);

    expect(bootNotification.currentTime).to.equal(chargingStationResponse.data.lastReboot);

    const bootNotification2 = await testData.dataHelper.sendBootNotification(testData.defaultChargingStation);
    chargingStationResponse = await testData.dataHelper.getChargingStation(testData.defaultChargingStation, false);

    expect(bootNotification2.currentTime).to.equal(chargingStationResponse.data.lastReboot);

    expect(bootNotification.currentTime).to.not.equal(bootNotification2.currentTime);
    expect(new Date(bootNotification.currentTime)).to.beforeTime(new Date(bootNotification2.currentTime));


    const bootNotification15 = await testData.dataHelper15.sendBootNotification(testData.defaultChargingStation15);
    let chargingStationResponse15 = await testData.dataHelper15.getChargingStation(testData.defaultChargingStation15, false);

    expect(bootNotification15.currentTime.toISOString()).to.equal(chargingStationResponse15.data.lastReboot);

    const bootNotification152 = await testData.dataHelper15.sendBootNotification(testData.defaultChargingStation15);
    chargingStationResponse15 = await testData.dataHelper15.getChargingStation(testData.defaultChargingStation15, false);

    expect(bootNotification152.currentTime.toISOString()).to.equal(chargingStationResponse15.data.lastReboot);

    expect(bootNotification15.currentTime).to.not.equal(bootNotification152.currentTime);
    expect(bootNotification15.currentTime).to.beforeTime(bootNotification152.currentTime);
  });
});

