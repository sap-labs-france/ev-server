// Goal : Checks related to settings
// Note : These unit tests use the tenant utall. This tenant should exist prior running these tests.
//        Run npm run mochatest:createContext to create the needed utall if not present.
import chai, { expect } from 'chai';

import CentralServerService from './client/CentralServerService';
import { HTTPError } from '../../src/types/HTTPError';
import { StatusCodes } from 'http-status-codes';
import TestData from './client/utils/TestData';
import chaiSubset from 'chai-subset';
import config from '../config';
import responseHelper from '../helpers/responseHelper';

chai.use(chaiSubset);
chai.use(responseHelper);

const FAKE_WORD = 'Expelliarmus';
const testData: TestData = new TestData();
let oldSetting = {};

describe('Encryption Setting', () => {
  jest.setTimeout(60000);

  beforeAll(() => {
    // Init values
    testData.centralService = new CentralServerService('utall', { email: config.get('admin.username'), password: config.get('admin.password') });
  });

  afterEach(async () => {
    // Housekeeping
    const update = await testData.centralService.updateEntity(testData.centralService.settingApi, oldSetting);
    expect(update.status).to.equal(StatusCodes.OK);
  });

  afterAll(async () => {
    // Housekeeping
  });

  describe('Success cases (utall)', () => {
    it(
      'Check that updating the refund/concur setting works with sensitive data encryption',
      async () => {
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
      }
    );
  });
});
