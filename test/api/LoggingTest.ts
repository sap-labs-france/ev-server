// Goal : Checks related to Logging
// Note : These unit tests use the default tenant.
//        

import path from 'path';
import global from '../../src/types/GlobalType';
global.appRoot = path.resolve(__dirname, '../../src');
import chai, { expect } from 'chai';
import chaiSubset from 'chai-subset';
import CentralServerService from './client/CentralServerService';
import Constants from './client/utils/Constants';
import config from '../config';
import responseHelper from '../helpers/responseHelper';

chai.use(chaiSubset);
chai.use(responseHelper);

import TestData from './client/utils/TestData';

const testData: TestData = new TestData();

describe('Logging tests', function() {
  this.timeout(30000);

  before( async function() {
    // Init values
    testData.centralService = new CentralServerService('slf', { email: config.get('admin.username'), password: config.get('admin.password') });
  });

  after( async function() {
    // Housekeeping
  });


  describe('Success cases', () => {
    it('Check that retrieving logs ', async () => {
      // Retrieve the setting id
      let read = await testData.centralService.logsApi.readAll({ "Action" : "ChargingStationDelete|DataTransfer" },{ limit: 10, skip: 0 });
      expect(read.status).to.equal(200);
    });
  });
});
