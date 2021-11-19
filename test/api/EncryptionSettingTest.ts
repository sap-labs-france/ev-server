// Goal : Checks related to settings
// Note : These unit tests use the tenant utall. This tenant should exist prior running these tests.
//        Run npm run mochatest:createContext to create the needed utall if not present.
import chai, { expect } from 'chai';

import CentralServerService from './client/CentralServerService';
import { StatusCodes } from 'http-status-codes';
import TestConstants from './client/utils/TestConstants';
import TestData from './client/utils/TestData';
import chaiSubset from 'chai-subset';
import config from '../config';
import responseHelper from '../helpers/responseHelper';

chai.use(chaiSubset);
chai.use(responseHelper);

const FAKE_WORD = 'Expelliarmus';
const testData: TestData = new TestData();
let oldSetting = {};

describe('Encryption Setting', function() {
  this.timeout(30000);

  before(function() {
    // Init values
    testData.centralService = new CentralServerService('utall', { email: config.get('admin.username'), password: config.get('admin.password') });
  });

  afterEach(async function() {
    // Housekeeping
    const update = await testData.centralService.updateEntity(testData.centralService.settingApi, oldSetting);
    expect(update.status).to.equal(StatusCodes.OK);
  });

  after(async function() {
    // Housekeeping
  });

  describe('Success cases (utall)', () => {
    it('Check that updating the refund/concur setting works with sensitive data encryption', async () => {
      // Retrieve the setting id
      let read = await testData.centralService.settingApi.readByIdentifier({ 'Identifier': 'refund' });
      expect(read.status).to.equal(StatusCodes.OK);
      expect(read.data).to.not.be.null;
      // Store the old setting
      oldSetting = read.data;
      // Update the setting
      testData.data = JSON.parse(`{
          "id":"${read.data.id}",
          "identifier":"refund",
          "sensitiveData":["content.concur.clientSecret"],
          "content":{
              "concur":{
                  "authenticationUrl":"http://app.test.com",
                  "apiUrl":"http://api.test.com",
                  "clientId":"CID",
                  "clientSecret":"${FAKE_WORD}",
                  "paymentTypeId":"PID",
                  "expenseTypeCode":"ETC",
                  "policyId":"PID",
                  "reportName":"REPORT"
                },
                "type":"concur"
            }
        }`);
      const update = await testData.centralService.updateEntity(testData.centralService.settingApi, testData.data);
      expect(update.status).to.equal(StatusCodes.OK);
      // Retrieve the updated setting and check
      read = await testData.centralService.settingApi.readByIdentifier({ 'Identifier': 'refund' });
      expect(read.status).to.equal(StatusCodes.OK);
      expect(read.data).to.not.be.null;
      expect(read.data.sensitiveData[0]).to.equal('content.concur.clientSecret');
      expect(read.data.content.concur.clientSecret).to.not.equal(FAKE_WORD);
    });

    it('Check that updating the pricing/convergent charging setting works with sensitive data encryption', async () => {
      // Retrieve the setting id
      let read = await testData.centralService.settingApi.readByIdentifier({ 'Identifier': 'pricing' });
      expect(read.status).to.equal(StatusCodes.OK);
      expect(read.data).to.not.be.null;
      // Store the old setting
      oldSetting = read.data;
      // Update the setting
      testData.data = JSON.parse(`{
            "id":"${read.data.id}",
            "identifier":"pricing",
            "sensitiveData":["content.convergentCharging.password"],
            "content":{
                "type":"convergentCharging",
                "convergentCharging":{
                    "url":"http://test.com",
                    "chargeableItemName":"IN",
                    "user":"HarryPotter",
                    "password":"${FAKE_WORD}"
                }
            }
        }`);
      const update = await testData.centralService.updateEntity(testData.centralService.settingApi, testData.data);
      expect(update.status).to.equal(StatusCodes.OK);
      // Retrieve the updated setting and check
      read = await testData.centralService.settingApi.readByIdentifier({ 'Identifier': 'pricing' });
      expect(read.status).to.equal(StatusCodes.OK);
      expect(read.data).to.not.be.null;
      expect(read.data.sensitiveData[0]).to.equal('content.convergentCharging.password');
      expect(read.data.content.convergentCharging.password).to.not.equal(FAKE_WORD);
      // Housekeeping set the pricing setting back to simple pricing
      testData.data = JSON.parse(`{
        "id":"${read.data.id}",
        "identifier": "pricing",
        "sensitiveData":[],
        "content":{
          "type": "simple",
          "simple": {
              "price": "1",
              "currency": "EUR"
          }
        }
      }`);
      const response = await testData.centralService.updateEntity(testData.centralService.settingApi, testData.data);
      expect(response.status).to.equal(StatusCodes.OK);
    });
  });
});
