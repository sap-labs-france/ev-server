import chai, { expect } from 'chai';

import { Car } from '../../src/types/Car';
import CentralServerService from './client/CentralServerService';
import Constants from '../../src/utils/Constants';
import ContextDefinition from './context/ContextDefinition';
import ContextProvider from './context/ContextProvider';
import Factory from '../factories/Factory';
import { HTTPError } from '../../src/types/HTTPError';
import { StatusCodes } from 'http-status-codes';
import TenantContext from './context/TenantContext';
import User from '../../src/types/User';
import chaiSubset from 'chai-subset';
import config from '../config';
import { faker } from '@faker-js/faker';

chai.use(chaiSubset);
class TestData {
  public superCentralService: CentralServerService;
  public centralService: CentralServerService;
  public newCar: Car;
  public createdCars: Car[] = [];
  public tenantContext: TenantContext;
  public userContext: User;
}
const testData: TestData = new TestData();
let carID: number;
describe('Car', () => {
  jest.setTimeout(60000);
  beforeAll(async () => {
    // Init values
    testData.superCentralService = new CentralServerService(null, { email: config.get('superadmin.username'), password: config.get('superadmin.password') });
    testData.tenantContext = await ContextProvider.defaultInstance.getTenantContext(ContextDefinition.TENANT_CONTEXTS.TENANT_CAR);
    testData.userContext = testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.BASIC_USER);
    testData.centralService = new CentralServerService(ContextDefinition.TENANT_CONTEXTS.TENANT_CAR, {
      email: config.get('admin.username'),
      password: config.get('admin.password')
    });

  });

  afterAll(() => {
  });

  describe('Without any component (utnothing)', () => {
    describe('Where admin user', () => {
      beforeAll(() => {

        testData.centralService = new CentralServerService(ContextDefinition.TENANT_CONTEXTS.TENANT_WITH_NO_COMPONENTS, {
          email: config.get('admin.username'),
          password: config.get('admin.password')
        });

      });
      it('Should not be able to get car catalogs', async () => {
        const response = await testData.centralService.carApi.readCarCatalogs({});
        expect(response.status).to.equal(StatusCodes.FORBIDDEN);
      });

      it('Should not be able to get car catalog by ID', async () => {
        const response = await testData.centralService.carApi.readCarCatalog(null);
        expect(response.status).to.equal(StatusCodes.FORBIDDEN);
      });

      it('Should not be able to get image of a car', async () => {
        const response = await testData.centralService.carApi.readCarImages(null);
        expect(response.status).to.equal(StatusCodes.FORBIDDEN);
      });

      it('Should not be able to get car makers', async () => {
        const response = await testData.centralService.carApi.readCarMakers({});
        expect(response.status).to.equal(StatusCodes.FORBIDDEN);
      });

      it('Should not be able to get a detailed car catalog', async () => {
        const response = await testData.centralService.carApi.readCarCatalog(null);
        expect(response.status).to.equal(StatusCodes.FORBIDDEN);
      });
    });
  });

  describe('With component Car (utcar)', () => {
    describe('Where admin user', () => {

      beforeAll(() => {
        testData.centralService = new CentralServerService(ContextDefinition.TENANT_CONTEXTS.TENANT_CAR, {
          email: config.get('admin.username'),
          password: config.get('admin.password')
        });
      });
      it('Should be able to get car catalogs', async () => {
        const response = await testData.centralService.carApi.readCarCatalogs({});
        carID = response.data.result[0].id;
        expect(response.status).to.equal(StatusCodes.OK);
      });

      it('Should be able to get car catalog by ID', async () => {
        const response = await testData.centralService.carApi.readCarCatalog(carID);
        expect(response.status).to.equal(StatusCodes.OK);
      });

      it('Should be able to get image of a car', async () => {
        const response = await testData.centralService.carApi.readCarImages(carID);
        expect(response.status).to.equal(StatusCodes.OK);
      });

      it('Should be able to get car makers', async () => {
        const response = await testData.centralService.carApi.readCarMakers({});
        expect(response.status).to.equal(StatusCodes.OK);
      });

      it(
        'Should not be able to get a detailed car catalog without ID',
        async () => {
          const response = await testData.centralService.carApi.readCarCatalog(null);
          expect(response.status).to.equal(StatusCodes.BAD_REQUEST);
        }
      );

      it('Should be able to create a new car', async () => {
        // Create
        const newCar = Factory.car.build();
        newCar.userID = testData.userContext.id;
        newCar.default = false;
        newCar.carCatalogID = (await testData.centralService.carApi.readCarCatalogs({}, Constants.DB_PARAMS_SINGLE_RECORD)).data.result[0].id;
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
        expect(response.status).to.equal(StatusCodes.BAD_REQUEST);
      });

      it(
        'Should not be able to create a new car without a license plate',
        async () => {
          // Create
          const response = await testData.centralService.createEntity(
            testData.centralService.carApi,
            Factory.car.build({
              licensePlate: null,
            }), false
          );
          expect(response.status).to.equal(StatusCodes.BAD_REQUEST);
        }
      );

      it('Should not be able to create a new car without a car type', async () => {
        // Create
        const response = await testData.centralService.createEntity(
          testData.centralService.carApi,
          Factory.car.build({
            type: null,
          }), false
        );
        expect(response.status).to.equal(StatusCodes.BAD_REQUEST);
      });

      it(
        'Should not be able to create a new car without a car catalog ID',
        async () => {
          // Create
          const response = await testData.centralService.createEntity(
            testData.centralService.carApi,
            Factory.car.build({
              carCatalogID: null,
            }), false
          );
          expect(response.status).to.equal(StatusCodes.INTERNAL_SERVER_ERROR);
        }
      );

      it(
        'Should not be able to create a new car with existent VIN and License Plate',
        async () => {
          // Create
          const response = await testData.centralService.createEntity(
            testData.centralService.carApi,
            Factory.car.build({
              vin: testData.newCar.vin,
              licensePlate: testData.newCar.licensePlate,
              carCatalogID: (await testData.centralService.carApi.readCarCatalogs({}, Constants.DB_PARAMS_SINGLE_RECORD)).data.result[0].id
            }), false
          );
          expect(response.status).to.equal(HTTPError.CAR_ALREADY_EXIST_ERROR);
        }
      );

      it('Should be able to update a car', async () => {
        // Update
        const carToUpdate = (await testData.centralService.carApi.readCar(testData.createdCars[0].id)).data;
        carToUpdate.converter = {
          'amperagePerPhase': faker.datatype.number(64),
          'numberOfPhases': faker.datatype.number({ min: 1, max: 4 }),
          'type': 'S',
          'powerWatts': faker.datatype.number(32)
        };
        testData.newCar = await testData.centralService.updateEntity(
          testData.centralService.carApi,
          carToUpdate
        );
      });
      it(
        'Should not be able to update a car with existent VIN and License Plate',
        async () => {
          // Create
          testData.newCar = await testData.centralService.createEntity(
            testData.centralService.carApi,
            Factory.car.build({
              carCatalogID: (await testData.centralService.carApi.readCarCatalogs({}, Constants.DB_PARAMS_SINGLE_RECORD)).data.result[0].id
            })
          );
          testData.createdCars.push(testData.newCar);
          testData.newCar.vin = testData.createdCars[0].vin;
          testData.newCar.licensePlate = testData.createdCars[0].licensePlate;
          const response = await testData.centralService.updateEntity(
            testData.centralService.carApi,
            testData.newCar,
            false
          );
          expect(response.status).to.equal(HTTPError.CAR_ALREADY_EXIST_ERROR);
        }
      );

      it('Should be able to get car', async () => {
        const response = await testData.centralService.carApi.readCar(testData.newCar.id);
        expect(response.status).to.equal(StatusCodes.OK);
      });

      it('Should be able to get cars', async () => {
        const response = await testData.centralService.carApi.readCars({});
        expect(response.status).to.equal(StatusCodes.OK);
      });
    });
    describe('Where basic user', () => {
      beforeAll(() => {
        testData.centralService = new CentralServerService(ContextDefinition.TENANT_CONTEXTS.TENANT_CAR, testData.userContext);
      });

      it('Should be able to create a new car', async () => {
        // Create
        const carToCreate = Factory.car.build();
        carToCreate.userID = testData.userContext.id;
        carToCreate.default = false;
        carToCreate.carCatalogID = (await testData.centralService.carApi.readCarCatalogs({}, Constants.DB_PARAMS_SINGLE_RECORD)).data.result[0].id;
        testData.newCar = await testData.centralService.createEntity(
          testData.centralService.carApi,
          carToCreate
        );
        testData.createdCars.push(testData.newCar);
      });

      it('Should not be able to create a pool car', async () => {
        // Update
        const newCar = Factory.car.build({
          type: 'PC',
          carCatalogID: (await testData.centralService.carApi.readCarCatalogs({}, Constants.DB_PARAMS_SINGLE_RECORD)).data.result[0].id
        });
        const response = await testData.centralService.createEntity(
          testData.centralService.carApi,
          newCar, false
        );
        expect(response.status).to.equal(StatusCodes.FORBIDDEN);
      });

      it('Should be able to update a car that he owns', async () => {
        // Update
        const response = (await testData.centralService.carApi.readCar(testData.newCar.id));
        expect(response.status).to.equal(StatusCodes.OK);
        const carToUpdate = response.data;
        carToUpdate.converter = {
          'amperagePerPhase': faker.datatype.number(64),
          'numberOfPhases': faker.datatype.number({ min: 1, max: 4 }),
          'type': 'S',
          'powerWatts': faker.datatype.number(32)
        };
        await testData.centralService.updateEntity(
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
        expect(response.status).to.equal(StatusCodes.NOT_FOUND);
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
        expect(response.status).to.equal(StatusCodes.FORBIDDEN);
      });

      it('Should not be able to update not owned car', async () => {
        // Update
        const response = await testData.centralService.updateEntity(
          testData.centralService.carApi,
          testData.createdCars[1],
          false
        );
        expect(response.status).to.equal(StatusCodes.FORBIDDEN);
      });
    });

    afterAll(async () => {
      testData.centralService = new CentralServerService(ContextDefinition.TENANT_CONTEXTS.TENANT_CAR, {
        email: config.get('admin.username'),
        password: config.get('admin.password')
      });
      // Delete any created car
      for (const car of testData.createdCars) {
        await testData.centralService.deleteEntity(
          testData.centralService.carApi,
          car,
          false
        );
      }
    });
  });

  describe('Where Super admin user', () => {
    it('Should be able to get car catalog by ID', async () => {
      const response = await testData.centralService.carApiSuperTenant.readCarCatalog(carID);
      expect(response.status).to.equal(StatusCodes.OK);
    });

    it('Should be able to get image of a car', async () => {
      const response = await testData.centralService.carApiSuperTenant.readCarImages(carID);
      expect(response.status).to.equal(StatusCodes.OK);
    });

    it('Should be able to get car makers', async () => {
      const response = await testData.centralService.carApiSuperTenant.readCarMakers({});
      expect(response.status).to.equal(StatusCodes.OK);
    });

    it(
      'Should not be able to get a detailed car catalog without ID',
      async () => {
        const response = await testData.centralService.carApiSuperTenant.readCarCatalog(null);
        expect(response.status).to.equal(StatusCodes.BAD_REQUEST);
      }
    );

    it('Should be able to get car catalog debug object', async () => {
      const response = await testData.centralService.carApiSuperTenant.readCarCatalog(carID);
      expect(response.status).to.equal(StatusCodes.OK);
      expect(response.data).to.have.property('hash');
    });

    it('Should be able to get car catalogs', async () => {
      const response = await testData.centralService.carApiSuperTenant.readCarCatalogs({});
      expect(response.status).to.equal(StatusCodes.OK);
    });

    it('Should not be able to get cars from super tenant', async () => {
      const response = await testData.centralService.carApiSuperTenant.readCars({});
      expect(response.status).to.equal(StatusCodes.FORBIDDEN);
    });

    it('Should not be able to get car from super tenant', async () => {
      const response = await testData.centralService.carApiSuperTenant.readCar('');
      expect(response.status).to.equal(StatusCodes.FORBIDDEN);
    });

    it('Should not be able to create a car from super tenant', async () => {
      // Create
      const response = await testData.centralService.createEntity(
        testData.centralService.carApiSuperTenant,
        Factory.car.build(),
        false
      );
      expect(response.status).to.equal(StatusCodes.FORBIDDEN);
    });
  });
});
