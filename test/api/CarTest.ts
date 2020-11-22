import chai, { expect } from 'chai';

import { Car } from '../types/Car';
import CentralServerService from './client/CentralServerService';
import ContextDefinition from './context/ContextDefinition';
import ContextProvider from './context/ContextProvider';
import Factory from '../factories/Factory';
import TenantContext from './context/TenantContext';
import User from '../types/User';
import chaiSubset from 'chai-subset';
import config from '../config';

chai.use(chaiSubset);
class TestData {
  public data: any;
  public superCentralService: CentralServerService;
  public centralService: CentralServerService;
  public credentials: any = {};
  public newCar: Car;
  public createdCars: Car[] = [];
  public tenantContext: TenantContext;
  public userContext: User;
}
const testData: TestData = new TestData();
let carID: number;
describe('Car Tests', function() {
  this.timeout(500000);
  before(async function() {
    // Init values
    testData.superCentralService = new CentralServerService(null, { email: config.get('superadmin.username'), password: config.get('superadmin.password') });
    testData.tenantContext = await ContextProvider.defaultInstance.getTenantContext(ContextDefinition.TENANT_CONTEXTS.TENANT_CAR);
    testData.userContext = testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.BASIC_USER);
    testData.centralService = new CentralServerService(ContextDefinition.TENANT_CONTEXTS.TENANT_CAR, {
      email: config.get('admin.username'),
      password: config.get('admin.password')
    });

  });

  after(() => {
  });
  describe('Success cases', () => {

    describe('Without any component (tenant utnothing)', () => {
      describe('Where admin user', () => {
        before(async function() {

          testData.centralService = new CentralServerService(ContextDefinition.TENANT_CONTEXTS.TENANT_WITH_NO_COMPONENTS, {
            email: config.get('admin.username'),
            password: config.get('admin.password')
          });

        });
        it('Should not be able to get car catalogs', async () => {
          const response = await testData.centralService.carApi.readCarCatalogs({});
          expect(response.status).to.equal(560);
        });

        it('Should not be able to get car catalog by ID', async () => {
          const response = await testData.centralService.carApi.readCarCatalog(null);
          expect(response.status).to.equal(560);
        });

        it('Should not be able to get image of a car', async () => {
          const response = await testData.centralService.carApi.readCarImages(null);
          expect(response.status).to.equal(560);
        });

        it('Should not be able to get car makers', async () => {
          const response = await testData.centralService.carApi.readCarMakers({});
          expect(response.status).to.equal(560);
        });

        it('Should not be able to get a detailed car catalog', async () => {
          const response = await testData.centralService.carApi.readCarCatalog(null);
          expect(response.status).to.equal(560);
        });
      });
    });

    describe('With component Car (tenant utcar)', () => {
      describe('Where admin user', () => {

        before(async function() {

          testData.centralService = new CentralServerService(ContextDefinition.TENANT_CONTEXTS.TENANT_CAR, {
            email: config.get('admin.username'),
            password: config.get('admin.password')
          });
        });
        it('Should be able to get car catalogs', async () => {
          const response = await testData.centralService.carApi.readCarCatalogs({});
          carID = response.data.result[0].id;
          expect(response.status).to.equal(200);
        });

        it('Should be able to get car catalog by ID', async () => {
          const response = await testData.centralService.carApi.readCarCatalog(carID);
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

        it('Should not be able to get a detailed car catalog without ID', async () => {
          const response = await testData.centralService.carApi.readCarCatalog(null);
          expect(response.status).to.equal(500);
        });

        it('Should be able to create a new car', async () => {
          // Create
          const newCar = Factory.car.build();
          newCar['usersUpserted'] = [{
            user: { id: testData.userContext.id },
            default: false,
            owner: false
          }];
          testData.newCar = await testData.centralService.createEntity(
            testData.centralService.carApi,
            newCar
          );
          testData.createdCars.push(testData.newCar);
        });

        it('Should not be able to create a new car without a vin', async () => {
          // Create
          const response = await testData.centralService.createEntity(
            testData.centralService.carApi,
            Factory.car.build({
              vin: null,
            }), false
          );
          expect(response.status).to.equal(500);
          expect(response.data.message).to.equal('Vin Car is mandatory');
        });

        it('Should not be able to create a new car without a license plate', async () => {
          // Create
          const response = await testData.centralService.createEntity(
            testData.centralService.carApi,
            Factory.car.build({
              licensePlate: null,
            }), false
          );
          expect(response.status).to.equal(500);
          expect(response.data.message).to.equal('License Plate is mandatory');
        });

        it('Should not be able to create a new car without a car type', async () => {
          // Create
          const response = await testData.centralService.createEntity(
            testData.centralService.carApi,
            Factory.car.build({
              type: null,
            }), false
          );
          expect(response.status).to.equal(500);
          expect(response.data.message).to.equal('Car type is mandatory');
        });

        it('Should not be able to create a new car without a car catalog ID', async () => {
          // Create
          const response = await testData.centralService.createEntity(
            testData.centralService.carApi,
            Factory.car.build({
              carCatalogID: null,
            }), false
          );
          expect(response.status).to.equal(500);
          expect(response.data.message).to.equal('Car Catalog ID is mandatory');
        });

        it('Should not be able to create a new car with existent VIN and License Plate', async () => {
          // Create
          const response = await testData.centralService.createEntity(
            testData.centralService.carApi,
            Factory.car.build({
              vin: testData.newCar.vin,
              licensePlate: testData.newCar.licensePlate,
            }), false
          );
          expect(response.status).to.equal(591);
        });

        it('Should be able to update a car', async () => {
          // Update
          const carToUpdate = (await testData.centralService.carApi.readCar(testData.createdCars[0].id)).data;
          const carUsers = (await testData.centralService.carApi.readCarUsers({ CarID: testData.createdCars[0].id })).data.result;
          carToUpdate.carCatalogID = 1010;
          carToUpdate['usersRemoved'] = [carUsers.find((carUser) => carUser.user.id === testData.userContext.id)];
          carToUpdate['usersUpserted'] = [];
          testData.newCar = await testData.centralService.updateEntity(
            testData.centralService.carApi,
            carToUpdate
          );
        });
        it('Should not be able to update a car with existent VIN and License Plate', async () => {
          // Create
          testData.newCar = await testData.centralService.createEntity(
            testData.centralService.carApi,
            Factory.car.build()
          );
          testData.createdCars.push(testData.newCar);
          testData.newCar.vin = testData.createdCars[0].vin;
          testData.newCar.licensePlate = testData.createdCars[0].licensePlate;
          const response = await testData.centralService.updateEntity(
            testData.centralService.carApi,
            testData.newCar,
            false
          );
          expect(response.status).to.equal(591);
        });

        it('Should be able to get car', async () => {
          const response = await testData.centralService.carApi.readCar(testData.newCar.id);
          expect(response.status).to.equal(200);
        });

        it('Should be able to get cars', async () => {
          const response = await testData.centralService.carApi.readCars({});
          expect(response.status).to.equal(200);
        });
      });
      describe('Where basic user', () => {
        before(async function() {
          testData.centralService = new CentralServerService(ContextDefinition.TENANT_CONTEXTS.TENANT_CAR, testData.userContext);
        });

        it('Should be able to create a new car', async () => {
          // Create
          const userCar = [{
            user: { id: testData.userContext.id },
            default: false
          }];
          const carToCreate = Factory.car.build();
          carToCreate.usersUpserted = userCar;
          testData.newCar = await testData.centralService.createEntity(
            testData.centralService.carApi,
            carToCreate
          );
          testData.createdCars.push(testData.newCar);
        });

        it('Should be able to assign himself to an existing car', async () => {
          // Create
          const userCar = [{
            user: { id: testData.userContext.id },
            default: false
          }];
          testData.createdCars[0]['usersUpserted'] = userCar;
          const response = await testData.centralService.createEntity(
            testData.centralService.carApi,
            testData.createdCars[0], false
          );
          expect(response.status).to.equal(592);
          testData.createdCars[0]['forced'] = true;
          await testData.centralService.createEntity(
            testData.centralService.carApi,
            testData.createdCars[0]
          );
        });

        it('Should not be able to create a pool car', async () => {
          // Update
          const newCar = Factory.car.build({ type: 'PC' });
          const response = await testData.centralService.createEntity(
            testData.centralService.carApi,
            newCar, false
          );
          expect(response.status).to.equal(500);
          expect(response.data.message).to.equal('Pool cars can only be created by admin');
        });

        it('Should be able to update a car that he own', async () => {
          // Update
          const carToUpdate = (await testData.centralService.carApi.readCar(testData.newCar.id)).data;
          carToUpdate.carCatalogID = 1004;
          const response = await testData.centralService.updateEntity(
            testData.centralService.carApi,
            carToUpdate
          );
        });

        it('Should not be able to delete a not owned car', async () => {
          const response = await testData.centralService.deleteEntity(
            testData.centralService.carApi,
            testData.createdCars[1],
            false
          );
          expect(response.status).to.equal(550);
        });

        it('Should not be able to update a car to a pool car', async () => {
          // Update
          const carToUpdate = (await testData.centralService.carApi.readCar(testData.newCar.id)).data;
          carToUpdate.type = 'PC';
          const response = await testData.centralService.updateEntity(
            testData.centralService.carApi,
            carToUpdate,
            false
          );
          expect(response.status).to.equal(500);
          expect(response.data.message).to.equal('Pool cars can only be created by admin');
        });

        it('Should not be able to update not owned car', async () => {
          // Update
          const response = await testData.centralService.updateEntity(
            testData.centralService.carApi,
            testData.createdCars[1],
            false
          );
          expect(response.status).to.equal(550);
        });
      });

      after(async () => {
        testData.centralService = new CentralServerService(ContextDefinition.TENANT_CONTEXTS.TENANT_CAR, {
          email: config.get('admin.username'),
          password: config.get('admin.password')
        });
        // Delete any created car
        testData.createdCars.forEach(async (car) => {
          await testData.centralService.deleteEntity(
            testData.centralService.carApi,
            car,
            false
          );
        });
      });
    });

    describe('Where Super admin user', () => {
      it('Should be able to get car catalog by ID', async () => {
        const response = await testData.centralService.carApiSuperTenant.readCarCatalog(carID);
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

      it('Should not be able to get a detailed car catalog without ID', async () => {
        const response = await testData.centralService.carApiSuperTenant.readCarCatalog(null);
        expect(response.status).to.equal(500);
      });

      it('Should be able to get car catalog debug object', async () => {
        const response = await testData.centralService.carApiSuperTenant.readCarCatalog(carID);
        expect(response.status).to.equal(200);
        expect(response.data).to.have.property('hash');
      });

      it('Should be able to get car catalogs', async () => {
        const response = await testData.centralService.carApiSuperTenant.readCarCatalogs({});
        expect(response.status).to.equal(200);
      });

      it('Should not be able to get cars from super tenant', async () => {
        const response = await testData.centralService.carApiSuperTenant.readCars({});
        expect(response.status).to.equal(560);
      });

      it('Should not be able to get car from super tenant', async () => {
        const response = await testData.centralService.carApiSuperTenant.readCar({});
        expect(response.status).to.equal(560);
      });

      it('Should not be able to create a car from super tenant', async () => {
        // Create
        const response = await testData.centralService.createEntity(
          testData.centralService.carApiSuperTenant,
          Factory.car.build(),
          false
        );
        expect(response.status).to.equal(560);
      });
    });
  });
});
