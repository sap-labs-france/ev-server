import chai, { expect } from 'chai';

import CentralServerService from './client/CentralServerService';
import ContextDefinition from './context/ContextDefinition';
import ContextProvider from './context/ContextProvider';
import Factory from '../factories/Factory';
import OCPIEndpoint from '../../src/types/ocpi/OCPIEndpoint';
import TenantContext from './context/TenantContext';
import User from '../../src/types/User';
import chaiSubset from 'chai-subset';

chai.use(chaiSubset);

class TestData {
  public centralUserService: CentralServerService;
  public tenantContext: TenantContext;
  public centralUserContext: any;
  public userContext: User;
  public newOcpiEndpoint: OCPIEndpoint;
}

const testData: TestData = new TestData();

describe('OCPI Endpoint (utocpi)', () => {
  jest.setTimeout(60000);
  beforeAll(async () => {
    testData.tenantContext = await ContextProvider.defaultInstance.getTenantContext(ContextDefinition.TENANT_CONTEXTS.TENANT_OCPI);
    testData.centralUserContext = testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN);
    testData.userContext = testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN);
    expect(testData.userContext).to.not.be.null;
    testData.centralUserService = new CentralServerService(
      testData.tenantContext.getTenant().subdomain,
      testData.centralUserContext
    );
  });

  describe('Success cases', () => {
    it('Should create a new Ocpi Endpoint', async () => {
      expect(testData.newOcpiEndpoint).to.not.be.null;
      // Create the entity
      testData.newOcpiEndpoint = await testData.centralUserService.createEntity(
        testData.centralUserService.ocpiEndpointApi, Factory.ocpiEndpoint.build({ }));
    });

    it('Should find the created Ocpi Endpoint by id', async () => {
      // Check if the created entity can be retrieved with its id
      await testData.centralUserService.getEntityById(
        testData.centralUserService.ocpiEndpointApi, testData.newOcpiEndpoint);
    });

    it(
      'Should find the created Ocpi Endpoint in the Ocpi Endpoint list',
      async () => {
        // Check if the created entity is in the list
        await testData.centralUserService.checkEntityInList(
          testData.centralUserService.ocpiEndpointApi, testData.newOcpiEndpoint);
      }
    );

    it('Should update the Ocpi Endpoint', async () => {
      // Change entity
      testData.newOcpiEndpoint.name = 'NewName';
      testData.newOcpiEndpoint.baseUrl = 'http://new.url/versions';
      testData.newOcpiEndpoint.countryCode = 'FR';
      testData.newOcpiEndpoint.partyId = 'AA';
      testData.newOcpiEndpoint.localToken = 'newlocaltoken';
      testData.newOcpiEndpoint.token = 'newremotetoken';
      // Update
      await testData.centralUserService.updateEntity(
        testData.centralUserService.ocpiEndpointApi, testData.newOcpiEndpoint);
    });

    it('Should find the updated Ocpi Endpoint by id', async () => {
      // Check if the updated entity can be retrieved with its id
      const updatedOcpiEndpoint = await testData.centralUserService.getEntityById(
        testData.centralUserService.ocpiEndpointApi, testData.newOcpiEndpoint);
      expect(updatedOcpiEndpoint.name).to.equal(testData.newOcpiEndpoint.name);
    });

    it('Should delete the created Ocpi Endpoint', async () => {
      // Delete the created entity
      await testData.centralUserService.deleteEntity(
        testData.centralUserService.ocpiEndpointApi, testData.newOcpiEndpoint);
    });

    it('Should not find the deleted Ocpi Endpoint with its id', async () => {
      // Check if the deleted entity cannot be retrieved with its id
      await testData.centralUserService.checkDeletedEntityById(
        testData.centralUserService.ocpiEndpointApi, testData.newOcpiEndpoint);
    });
  });

  describe('Error cases', () => {

  });
});
