import { ReasonPhrases, StatusCodes } from 'http-status-codes';
import chai, { expect } from 'chai';

import CentralServerService from './client/CentralServerService';
import ContextDefinition from './context/ContextDefinition';
import ContextProvider from './context/ContextProvider';
import Factory from '../factories/Factory';
import OICPEndpoint from '../../src/types/oicp/OICPEndpoint';
import TenantContext from './context/TenantContext';
import User from '../../src/types/User';
import chaiSubset from 'chai-subset';

chai.use(chaiSubset);

class TestData {
  public centralUserService: CentralServerService;
  public tenantContext: TenantContext;
  public centralUserContext: any;
  public userContext: User;
  public newOcpiEndpoint: OICPEndpoint;
}

const testData: TestData = new TestData();

describe('OICP Endpoint (utoicp)', () => {
  jest.setTimeout(30000);
  beforeAll(async () => {
    testData.tenantContext = await ContextProvider.defaultInstance.getTenantContext(ContextDefinition.TENANT_CONTEXTS.TENANT_OICP);
    testData.centralUserContext = testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN);
    testData.userContext = testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN);
    expect(testData.userContext).to.not.be.null;
    testData.centralUserService = new CentralServerService(
      testData.tenantContext.getTenant().subdomain,
      testData.centralUserContext
    );
  });

  describe('Success cases', () => {
    it('Should create a new OICP Endpoint', async () => {
      // Create the entity
      testData.newOcpiEndpoint = await testData.centralUserService.createEntity(
        testData.centralUserService.oicpEndpointApi, Factory.oicpEndpoint.build({}));
    });

    it('Should find the created OICP Endpoint by id', async () => {
      // Check if the created entity can be retrieved with its id
      await testData.centralUserService.getEntityById(
        testData.centralUserService.oicpEndpointApi, testData.newOcpiEndpoint);
    });

    it(
      'Should find the created OICP Endpoint in the OICP Endpoint list',
      async () => {
        // Check if the created entity is in the list
        await testData.centralUserService.checkEntityInList(
          testData.centralUserService.oicpEndpointApi, testData.newOcpiEndpoint);
      }
    );

    it('Should register the created OICP Endpoint', async () => {
      // Check if the deleted entity cannot be retrieved with its id
      const response = await testData.centralUserService.oicpEndpointApi.register(testData.newOcpiEndpoint.id);
      expect(response.status).to.be.equal(StatusCodes.OK);
      expect(response.data.statusCode).to.be.equal(StatusCodes.OK);
      expect(response.data.statusText).to.be.equal(ReasonPhrases.OK);
    });

    it('Should unregister the created OICP Endpoint', async () => {
      // Check if the deleted entity cannot be retrieved with its id
      const response = await testData.centralUserService.oicpEndpointApi.unregister(testData.newOcpiEndpoint.id);
      expect(response.status).to.be.equal(StatusCodes.OK);
      expect(response.data.statusCode).to.be.equal(StatusCodes.OK);
      expect(response.data.statusText).to.be.equal(ReasonPhrases.OK);
    });

    it('Should send EVSEs statuses', async () => {
      // Check if the deleted entity cannot be retrieved with its id
      const response = await testData.centralUserService.oicpEndpointApi.sendEvseStatuses(testData.newOcpiEndpoint.id);
      expect(response.status).to.be.equal(StatusCodes.OK);
      expect(response.data.success).to.be.equal(0);
      expect(response.data.failure).to.be.equal(0);
      expect(response.data.total).to.be.equal(0);
      expect(response.data.logs).to.be.null;
      expect(response.data.objectIDsInFailure.length).to.be.eq(0);
    });

    it('Should send EVSEs', async () => {
      // Check if the deleted entity cannot be retrieved with its id
      const response = await testData.centralUserService.oicpEndpointApi.sendEvses(testData.newOcpiEndpoint.id);
      expect(response.status).to.be.equal(StatusCodes.OK);
      expect(response.data.success).to.be.equal(0);
      expect(response.data.failure).to.be.equal(0);
      expect(response.data.total).to.be.equal(0);
      expect(response.data.logs).to.be.null;
      expect(response.data.objectIDsInFailure.length).to.be.eq(0);
    });

    it('Should update the OICP Endpoint', async () => {
      // Change entity
      testData.newOcpiEndpoint.name = 'NewName';
      testData.newOcpiEndpoint.baseUrl = 'http://new.url/versions';
      testData.newOcpiEndpoint.countryCode = 'FR';
      testData.newOcpiEndpoint.partyId = 'AA';
      // Update
      await testData.centralUserService.updateEntity(
        testData.centralUserService.oicpEndpointApi, testData.newOcpiEndpoint);
    });

    it('Should find the updated OICP Endpoint by id', async () => {
      // Check if the updated entity can be retrieved with its id
      const updatedOcpiEndpoint = await testData.centralUserService.getEntityById(
        testData.centralUserService.oicpEndpointApi, testData.newOcpiEndpoint);
      expect(updatedOcpiEndpoint.name).to.equal(testData.newOcpiEndpoint.name);
    });

    it('Should delete the created OICP Endpoint', async () => {
      // Delete the created entity
      await testData.centralUserService.deleteEntity(
        testData.centralUserService.oicpEndpointApi, testData.newOcpiEndpoint);
    });

    it('Should not find the deleted OICP Endpoint with its id', async () => {
      // Check if the deleted entity cannot be retrieved with its id
      await testData.centralUserService.checkDeletedEntityById(
        testData.centralUserService.oicpEndpointApi, testData.newOcpiEndpoint);
    });
  });
});
