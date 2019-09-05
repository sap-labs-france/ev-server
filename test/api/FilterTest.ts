// Goal : Checks related to Logging
// Note : These unit tests use the default tenant.
//
import chai, { expect } from 'chai';
import chaiSubset from 'chai-subset';
import config from '../config';
import responseHelper from '../helpers/responseHelper';
import CentralServerService from './client/CentralServerService';
import TestData from './client/utils/TestData';

chai.use(chaiSubset);
chai.use(responseHelper);

const testData: TestData = new TestData();

describe('Filters with multiple values tests', function() {
  this.timeout(100000);

  before(async function() {
    // Init values
    testData.centralService = new CentralServerService('slf', { email: config.get('admin.username'), password: config.get('admin.password') });
  });

  after(async function() {
    // Housekeeping
  });


  describe('Checks per application (tenant slf)', () => {
    it('Logs : Check that multi-filtering based on actions works', async () => {
      const read = await testData.centralService.logsApi.readAll({ 'Action' : 'ChargingStationDelete|DataTransfer' }, { limit: 10, skip: 0 });
      expect(read.status).to.equal(200);
    });

    it('Logs : Check that multi-filtering based on charging stations works', async () => {
      const read = await testData.centralService.logsApi.readAll({ 'Source' : 'SAP-Caen-01|SAP-Mougins-01' }, { limit: 10, skip: 0 });
      expect(read.status).to.equal(200);
    });

    it('Logs : Check that multi-filtering based on users works', async () => {
      const read = await testData.centralService.logsApi.readAll({ 'UserID' : '5bd8339cd0685c19bf056f51|5ca775dac521b1cec0e2ea19|5c5c4bd8084dd543fdcf2ee9' }, { limit: 10, skip: 0 });
      expect(read.status).to.equal(200);
    });

    it('Logs : Check that multi-filtering based on levels works', async () => {
      const read = await testData.centralService.logsApi.readAll({ 'Level' : 'E|I' }, { limit: 10, skip: 0 });
      expect(read.status).to.equal(200);
    });

    it('Charging stations : Check that multi-filtering based on sites works', async () => {
      const read = await testData.centralService.chargingStationApi.readAll({ 'SiteID' : '5abeba8d4bae1457eb565e5b|5abeba9e4bae1457eb565e66' }, { limit: 10, skip: 0 });
      expect(read.status).to.equal(200);
    });

    it('Charging stations in Error: Check that multi-filtering based on error types works', async () => {
      const read = await testData.centralService.chargingStationApi.readAllInError({ 'ErrorType' : 'missingSettings|connectionBroken|connectorError|missingSiteArea' }, { limit: 10, skip: 0 });
      expect(read.status).to.equal(200);
    });

    it('Organization-Sites : Check that multi-filtering based on companies works', async () => {
      const read = await testData.centralService.siteApi.readAll({ 'CompanyID' : '5abeba344bae1457eb565e27|5b3f5587000337ca85cee337' }, { limit: 10, skip: 0 });
      expect(read.status).to.equal(200);
    });

    it('Organization-Site areas : Check that multi-filtering based on sites works', async () => {
      const read = await testData.centralService.siteAreaApi.readAll({ 'SiteID' : '5abeba8d4bae1457eb565e5b|5abeba9e4bae1457eb565e66' }, { limit: 10, skip: 0 });
      expect(read.status).to.equal(200);
    });

    it('Users : Check that multi-filtering based on roles works', async () => {
      const read = await testData.centralService.userApi.readAll({ 'Role' : 'B|A' }, { limit: 10, skip: 0 });
      expect(read.status).to.equal(200);
    });

    it('Users : Check that multi-filtering based on status works', async () => {
      const read = await testData.centralService.userApi.readAll({ 'Status' : 'A|B' }, { limit: 10, skip: 0 });
      expect(read.status).to.equal(200);
    });

    it('Users in error : Check that multi-filtering based on roles works', async () => {
      const read = await testData.centralService.userApi.readAllInError({ 'Role' : 'B|A' }, { limit: 10, skip: 0 });
      expect(read.status).to.equal(200);
    });

    it('Sessions history : Check that multi-filtering based on charging stations works', async () => {
      const read = await testData.centralService.transactionApi.readAllCompleted({ 'ChargeBoxID' : 'SAP-Caen-01|SAP-Mougins-01' }, { limit: 10, skip: 0 });
      expect(read.status).to.equal(200);
    });

    it('Sessions history : Check that multi-filtering based on sites works', async () => {
      const read = await testData.centralService.transactionApi.readAllCompleted({ 'SiteID' : '5abeba9e4bae1457eb565e66' }, { limit: 10, skip: 0 });
      expect(read.status).to.equal(200);
    });

    it('Sessions in error : Check that multi-filtering based on sites works', async () => {
      const read = await testData.centralService.transactionApi.readAllInError({ 'SiteID' : '5abeba9e4bae1457eb565e66' }, { limit: 10, skip: 0 });
      expect(read.status).to.equal(200);
    });

    it('Sessions active : Check that multi-filtering based on sites works', async () => {
      const read = await testData.centralService.transactionApi.readAllActive({ 'SiteID' : '5abeba9e4bae1457eb565e66|5abeba8d4bae1457eb565e5b' }, { limit: 10, skip: 0 });
      expect(read.status).to.equal(200);
    });

  });
});
