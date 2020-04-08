import chaiSubset from 'chai-subset';
import CentralServerService from './client/CentralServerService';
import chai, { assert, expect } from 'chai';
import config from '../config';
import TestData from './client/utils/TestData';


chai.use(chaiSubset);
const testData: TestData = new TestData();
let carID: number;
describe('Car Service', function() {
  this.timeout(500000);
  before(async function() {
    // Init values
    testData.superCentralService = new CentralServerService(null, { email: config.get('superadmin.username'), password: config.get('superadmin.password') });

    testData.centralService = new CentralServerService('utcar', {
      email: config.get('admin.username'),
      password: config.get('admin.password')
    });

  });

  after(() => {
  });
  describe('Success cases', () => {
    describe('Where admin user', () => {
      describe('Where car component is not active', () => {
        before(async function() {

          testData.centralService = new CentralServerService('utbuilding', {
            email: config.get('admin.username'),
            password: config.get('admin.password')
          });

        });
        it('Should not be able to get cars', async () => {
          const response = await testData.centralService.carApi.readAll({});
          expect(response.status).to.equal(500);
        });

        it('Should not be able to get car by ID', async () => {
          const response = await testData.centralService.carApi.readById();
          expect(response.status).to.equal(500);
        });

        it('Should not be able to get image of a car', async () => {
          const response = await testData.centralService.carApi.readCarImages();
          expect(response.status).to.equal(500);
        });

        it('Should not be able to get car makers', async () => {
          const response = await testData.centralService.carApi.readCarMakers({});
          expect(response.status).to.equal(500);
        });

        it('Should not be able to get a detailed car', async () => {
          const response = await testData.centralService.carApi.readById();
          expect(response.status).to.equal(500);
        });
      });
      describe('Where car component is active', () => {
        before(async function() {

          testData.centralService = new CentralServerService('utcar', {
            email: config.get('admin.username'),
            password: config.get('admin.password')
          });

        });
        it('Should be able to get cars', async () => {
          const response = await testData.centralService.carApi.readAll({});
          carID = response.data.result[0].id;
          expect(response.status).to.equal(200);
        });

        it('Should be able to get car by ID', async () => {
          const response = await testData.centralService.carApi.readById(carID);
          expect(response.status).to.equal(200);
        });

        it('Should be able to get image of a car', async () => {
          const response = await testData.centralService.carApi.readCarImages(carID);
          expect(response.status).to.equal(200);
        });

        it('Should be able to get car makers', async () => {
          const response = await testData.centralService.carApi.readCarMakers({});
          expect(response.status).to.equal(200);
        });

        it('Should not be able to get a detailed car without ID', async () => {
          const response = await testData.centralService.carApi.readById();
          expect(response.status).to.equal(500);
        });

        it('Should not be able to get car debug object', async () => {
          const response = await testData.centralService.carApi.readById(carID);
          expect(response.status).to.equal(200);
          expect(response.data).to.not.have.property('carObject');
        });
      });
    });

    describe('Where Super admin user', () => {
      it('Should be able to get car by ID', async () => {
        const response = await testData.centralService.carApiSuperTenant.readById(carID);
        expect(response.status).to.equal(200);
      });

      it('Should be able to get image of a car', async () => {
        const response = await testData.centralService.carApiSuperTenant.readCarImages(carID);
        expect(response.status).to.equal(200);
      });

      it('Should be able to get car makers', async () => {
        const response = await testData.centralService.carApiSuperTenant.readCarMakers({});
        expect(response.status).to.equal(200);
      });

      it('Should not be able to get a detailed car without ID', async () => {
        const response = await testData.centralService.carApiSuperTenant.readById();
        expect(response.status).to.equal(500);
      });

      it('Should be able to get car debug object', async () => {
        const response = await testData.centralService.carApiSuperTenant.readById(carID);
        expect(response.status).to.equal(200);
        expect(response.data).to.have.property('carObject');
      });

      it('Should be able to get cars', async () => {
        const response = await testData.centralService.carApiSuperTenant.readAll({});
        expect(response.status).to.equal(200);
      });
    });
  });
});
