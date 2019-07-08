// Goal : Checks related to settings
// Note : These unit tests use the tenant utall. This tenant should exist prior running these tests.
//        Run npm run test:createContext to create the needed utall if not present.

import path from 'path';
import global from '../../src/types/GlobalType';
import chai, { expect } from 'chai';
import chaiSubset from 'chai-subset';
import CentralServerService from './client/CentralServerService';
import Constants from './client/utils/Constants';
import config from '../config';
import responseHelper from '../helpers/responseHelper';
import TestData from './client/utils/TestData';

global.appRoot = path.resolve(__dirname, '../../src');

chai.use(chaiSubset);
chai.use(responseHelper);

const FAKE_WORD = 'Expelliarmus';
const testData: TestData = new TestData();

describe('Encryption Setting tests', function() {
  this.timeout(30000);

  before(async function() {
    // Init values
    testData.centralService = new CentralServerService('utall', {
      email: config.get('admin.username'),
      password: config.get('admin.password')
    });
  });

  after(async function() {
    // Housekeeping
  });


  describe('Success cases', () => {
    it('Check that updating the refund/concur setting works with sensitive data encryption', async () => {
      // Retrieve the setting id
      let read = await testData.centralService.settingApi.readAll({ 'Identifier': 'refund' }, {
        limit: Constants.UNLIMITED,
        skip: 0
      });
      expect(read.status).to.equal(200);
      expect(read.data.count).to.equal(1);
      // Update the setting
      testData.data = JSON.parse(`{
          "id":"${read.data.result[0].id}",
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
      expect(update.status).to.equal(200);
      // Retrieve the updated setting and check
      read = await testData.centralService.settingApi.readAll({ 'Identifier': 'refund' }, {
        limit: Constants.UNLIMITED,
        skip: 0
      });
      expect(read.status).to.equal(200);
      expect(read.data.count).to.equal(1);
      expect(read.data.result[0].sensitiveData[0]).to.equal('content.concur.clientSecret');
      expect(read.data.result[0].content.concur.clientSecret).to.not.equal(FAKE_WORD);
    });

    it('Check that updating the pricing/convergent charging setting works with sensitive data encryption', async () => {
      // Retrieve the setting id
      let read = await testData.centralService.settingApi.readAll({ 'Identifier': 'pricing' }, {
        limit: Constants.UNLIMITED,
        skip: 0
      });
      expect(read.status).to.equal(200);
      expect(read.data.count).to.equal(1);
      // Update the setting
      testData.data = JSON.parse(`{
            "id":"${read.data.result[0].id}",
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
      expect(update.status).to.equal(200);
      // Retrieve the updated setting and check
      read = await testData.centralService.settingApi.readAll({ 'Identifier': 'pricing' }, {
        limit: Constants.UNLIMITED,
        skip: 0
      });
      expect(read.status).to.equal(200);
      expect(read.data.count).to.equal(1);
      expect(read.data.result[0].sensitiveData[0]).to.equal('content.convergentCharging.password');
      expect(read.data.result[0].content.convergentCharging.password).to.not.equal(FAKE_WORD);
    });
  });
});
