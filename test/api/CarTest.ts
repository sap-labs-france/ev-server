import chaiSubset from 'chai-subset';
import CentralServerService from './client/CentralServerService';
import chai, { assert, expect } from 'chai';
import config from '../config';
import TestData from './client/utils/TestData';


chai.use(chaiSubset);
const testData: TestData = new TestData();
describe('Car Service', function() {
  before(async function() {
    // Init values
    testData.superCentralService = new CentralServerService(null, { email: config.get('superadmin.username'), password: config.get('superadmin.password') });

    testData.centralService = new CentralServerService('utnothing', {
      email: config.get('admin.username'),
      password: config.get('admin.password')
    });

  });

  after(() => {
  });
  describe('Success cases', () => {
    describe('Where admin user', () => {
      it('Should be able to get cars', async () => {
        const response = await testData.centralService.carApi.readAll({});
        expect(response.status).to.equal(200);
      });

      it('Should be able to get car by ID', async () => {
        const response = await testData.centralService.carApi.readById('');
        expect(response.status).to.equal(200);
      });

      it('Should not be able to get the car Object', async () => {
        const response = await testData.centralService.carApi.getCarObject('');
        expect(response.status).to.equal(560);

      });

      describe('Where Super admin user', () => {
        it('Should be able to get car by ID', async () => {
          const response = await testData.centralService.carApi.readById('');
          expect(response.status).to.equal(200);
        });

        it('Should be able to get cars', async () => {
          const response = await testData.centralService.carApi.readAll({});
          expect(response.status).to.equal(200);
        });

        it('Should be able to get car Object', async () => {
          const response = await testData.superCentralService.carApiSuperTenant.getCarObject('');
          expect(response.status).to.equal(200);
        });
      });
    });
  });
});
