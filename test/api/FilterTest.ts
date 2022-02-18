// Goal : Checks related to Logging
// Note : These unit tests use the default tenant.
//
import chai, { expect } from 'chai';

import CentralServerService from './client/CentralServerService';
import { ChargingStationInErrorType } from '../../src/types/InError';
import { StatusCodes } from 'http-status-codes';
import TestData from './client/utils/TestData';
import chaiSubset from 'chai-subset';
import config from '../config';
import responseHelper from '../helpers/responseHelper';

chai.use(chaiSubset);
chai.use(responseHelper);

const testData: TestData = new TestData();

describe('Filters', () => {
  jest.setTimeout(100000);

  beforeAll(() => {
    // Init values
    testData.centralService = new CentralServerService('utall', { email: config.get('admin.username'), password: config.get('admin.password') });
  });

  afterAll(async () => {
    // Housekeeping
  });


  describe('Checks per application (slf)', () => {
    it('Logs : Check that multi-filtering based on actions works', async () => {
      const read = await testData.centralService.logsApi.readAll({ 'Action' : 'ChargingStationDelete|DataTransfer' }, { limit: 10, skip: 0 });
      expect(read.status).to.equal(StatusCodes.OK);
    });

    it(
      'Logs : Check that multi-filtering based on charging stations works',
      async () => {
        const read = await testData.centralService.logsApi.readAll({ 'Source' : 'SAP-Caen-01|SAP-Mougins-01' }, { limit: 10, skip: 0 });
        expect(read.status).to.equal(StatusCodes.OK);
      }
    );

    it('Logs : Check that multi-filtering based on users works', async () => {
      const read = await testData.centralService.logsApi.readAll({ 'UserID' : '5bd8339cd0685c19bf056f51|5ca775dac521b1cec0e2ea19|5c5c4bd8084dd543fdcf2ee9' }, { limit: 10, skip: 0 });
      expect(read.status).to.equal(StatusCodes.OK);
    });

    it('Logs : Check that multi-filtering based on levels works', async () => {
      const read = await testData.centralService.logsApi.readAll({ 'Level' : 'E|I' }, { limit: 10, skip: 0 });
      expect(read.status).to.equal(StatusCodes.OK);
    });

    it(
      'Charging stations : Check that multi-filtering based on sites works',
      async () => {
        const read = await testData.centralService.chargingStationApi.readAll({ 'SiteID' : '5abeba8d4bae1457eb565e5b|5abeba9e4bae1457eb565e66' }, { limit: 10, skip: 0 });
        expect(read.status).to.equal(StatusCodes.OK);
      }
    );

    it(
      'Charging stations in Error: Check that multi-filtering based on error types works',
      async () => {
        const read = await testData.centralService.chargingStationApi.readAllInError({ 'ErrorType' : ChargingStationInErrorType.MISSING_SETTINGS + '|' + ChargingStationInErrorType.CONNECTION_BROKEN + '|' + ChargingStationInErrorType.CONNECTOR_ERROR + '|' + ChargingStationInErrorType.MISSING_SITE_AREA }, { limit: 10, skip: 0 });
        expect(read.status).to.equal(StatusCodes.OK);
      }
    );

    it(
      'Organization-Sites : Check that multi-filtering based on companies works',
      async () => {
        const read = await testData.centralService.siteApi.readAll({ 'CompanyID' : '5abeba344bae1457eb565e27|5b3f5587000337ca85cee337' }, { limit: 10, skip: 0 });
        expect(read.status).to.equal(StatusCodes.OK);
      }
    );

    it(
      'Organization-Site areas : Check that multi-filtering based on sites works',
      async () => {
        const read = await testData.centralService.siteAreaApi.readAll({ 'SiteID' : '5abeba8d4bae1457eb565e5b|5abeba9e4bae1457eb565e66' }, { limit: 10, skip: 0 });
        expect(read.status).to.equal(StatusCodes.OK);
      }
    );

    it('Users : Check that multi-filtering based on roles works', async () => {
      const read = await testData.centralService.userApi.readAll({ 'Role' : 'B|A' }, { limit: 10, skip: 0 });
      expect(read.status).to.equal(StatusCodes.OK);
    });

    it('Users : Check that multi-filtering based on status works', async () => {
      const read = await testData.centralService.userApi.readAll({ 'Status' : 'A|B' }, { limit: 10, skip: 0 });
      expect(read.status).to.equal(StatusCodes.OK);
    });

    it(
      'Users in error : Check that multi-filtering based on roles works',
      async () => {
        const read = await testData.centralService.userApi.readAllInError({ 'Role' : 'B|A' }, { limit: 10, skip: 0 });
        expect(read.status).to.equal(StatusCodes.OK);
      }
    );

    it(
      'Sessions history : Check that multi-filtering based on charging stations works',
      async () => {
        const read = await testData.centralService.transactionApi.readAllCompleted({ 'ChargingStationID' : 'SAP-Caen-01|SAP-Mougins-01' }, { limit: 10, skip: 0 });
        expect(read.status).to.equal(StatusCodes.OK);
      }
    );

    it(
      'Sessions history : Check that multi-filtering based on sites works',
      async () => {
        const read = await testData.centralService.transactionApi.readAllCompleted({ 'SiteID' : '5abeba9e4bae1457eb565e66' }, { limit: 10, skip: 0 });
        expect(read.status).to.equal(StatusCodes.OK);
      }
    );

    it(
      'Sessions in error : Check that multi-filtering based on sites works',
      async () => {
        const read = await testData.centralService.transactionApi.readAllInError({ 'SiteID' : '5abeba9e4bae1457eb565e66' }, { limit: 10, skip: 0 });
        expect(read.status).to.equal(StatusCodes.OK);
      }
    );

    it(
      'Sessions active : Check that multi-filtering based on sites works',
      async () => {
        const read = await testData.centralService.transactionApi.readAllActive({ 'SiteID' : '5abeba9e4bae1457eb565e66|5abeba8d4bae1457eb565e5b' }, { limit: 10, skip: 0 });
        expect(read.status).to.equal(StatusCodes.OK);
      }
    );

    it(
      'Refund : Check that multi-filtering based on reports ID works',
      async () => {
        const read = await testData.centralService.transactionApi.readAllRefundReports({}, { limit: 10, skip: 0 });
        expect(read.status).to.equal(StatusCodes.OK);
        expect(read.data.result).to.not.be.empty;
        // Test for unicity
        for (let i = 0; i < read.data.result.length; i++) {
          expect(read.data.result[i].id).not.equal(null);
          expect(read.data.result[i].user).not.equal(null);
          for (let j = 0; j < read.data.result.length; j++) {
            if (i !== j) {
              expect(read.data.result[i]).not.equal(read.data.result[j]);
            }
          }
        }
      }
    );

  });
});
