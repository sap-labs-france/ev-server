// Goal : Checks related to settings
// Note : These unit tests use the tenant utall. This tenant should exist prior running these tests.
//        Run npm run mochatest:createContext to create the needed utall if not present.

import { CryptoKeyProperties, SettingDB } from '../../src/types/Setting';
import chai, { expect } from 'chai';

import CentralServerService from './client/CentralServerService';
import ContextDefinition from './context/ContextDefinition';
import ContextProvider from './context/ContextProvider';
import { HTTPError } from '../../src/types/HTTPError';
import { StatusCodes } from 'http-status-codes';
import Tenant from '../../src/types/Tenant';
import TenantContext from './context/TenantContext';
import TestConstants from './client/utils/TestConstants';
import Utils from '../../src/utils/Utils';
import chaiSubset from 'chai-subset';
import config from '../config';
import responseHelper from '../helpers/responseHelper';

chai.use(chaiSubset);
chai.use(responseHelper);

class TestData {
  public data: any;
  public superCentralService: CentralServerService;
  public centralService: CentralServerService;
  public credentials: any = {};
  public tenantContext: TenantContext;
  public centralUserContext: any;
  public centralUserService: CentralServerService;
  public userContext: any;
  public userService: CentralServerService;
}

const testData = new TestData();

let initialTenant: Tenant;

/**
 * Update pricing setting to have sensitive data to test on it
 */
async function updatePricingWithSensitiveDataAndCheckResultSuccessful(): Promise<void> {
  const crtPricingData = await testData.centralService.settingApi.readByIdentifier({ 'Identifier': 'refund' });
  expect(crtPricingData.status).to.equal(StatusCodes.OK);
  expect(crtPricingData.data).to.not.be.null;
  const clientSecret = 'a8242e0ed0fa70aee7c802e41e1c7c3b';
  testData.data = JSON.parse(`{
      "id":"${crtPricingData.data.id}",
      "identifier":"refund",
      "sensitiveData":["content.concur.clientSecret"],
      "content":{
        "type" : "concur",
        "concur" : {
            "authenticationUrl" : "https://url.com",
            "apiUrl" : "https://url.com",
            "appUrl" : "https://url.com",
            "clientId" : "6cf707fb-9161-48fa-94fe-9e003be680df",
            "clientSecret" : "${clientSecret}",
            "paymentTypeId" : "gWtUBRXx$s3h0bNdgyv9gwiHLnCGMF",
            "expenseTypeCode" : "01104",
            "policyId" : "1119",
            "reportName" : "E-Car Charging"
        }
    }
  }`);
  const update = await testData.centralService.updateEntity(testData.centralService.settingApi, testData.data);
  expect(update.status).to.equal(StatusCodes.OK);
}


function getCryptoTestSettings(originalCryptoObject: SettingDB, newKeyProperties: CryptoKeyProperties) {
  return JSON.parse(`{
    "id":"${originalCryptoObject.id}",
    "identifier":"${originalCryptoObject.identifier}",
    "sensitiveData":[],
    "content":{
      "type":"crypto",
      "crypto" : {
        "key" : "${Utils.generateRandomKey(newKeyProperties)}",
        "keyProperties" : {
            "blockCypher" : "${newKeyProperties.blockCypher}",
            "blockSize" : "${newKeyProperties.blockSize}",
            "operationMode" : "${newKeyProperties.operationMode}"
        },
        "formerKey" : "${originalCryptoObject.content.crypto.key}",
        "formerKeyProperties" : {
            "blockCypher" : "${originalCryptoObject.content.crypto.keyProperties.blockCypher}",
            "blockSize" : "${originalCryptoObject.content.crypto.keyProperties.blockSize}",
            "operationMode" : "${originalCryptoObject.content.crypto.keyProperties.operationMode}"
        },
        "migrationToBeDone" : true
      }
    }
}`);
}


async function getCurrentCryptoDataAndCheckResultSuccessful(): Promise<SettingDB> {
  const crtCryptoData = await testData.centralService.settingApi.readByIdentifier({ 'Identifier': 'crypto' });
  expect(crtCryptoData.status).to.equal(StatusCodes.OK);
  expect(crtCryptoData.data).to.not.be.null;
  return crtCryptoData.data;
}


async function resetCryptoSettingToDefault(): Promise<void> { // Aes-256-gcm
  const crtCryptoData = await getCurrentCryptoDataAndCheckResultSuccessful();
  await updateCryptoSettingsAndCheckResultSuccessful(crtCryptoData, 'aes', 256, 'gcm');
}


async function updateCryptoSettingsAndCheckResultSuccessful(crtData, blockCypher, blockSize, operationMode) {
  const newKeyProperties: CryptoKeyProperties = {
    blockCypher: blockCypher,
    blockSize: blockSize,
    operationMode: operationMode
  };
  testData.data = getCryptoTestSettings(crtData, newKeyProperties);
  const update = await testData.centralService.updateEntity(testData.centralService.settingApi, testData.data);
  expect(update.status).to.equal(StatusCodes.OK);
  return update;
}

describe('Setting', () => {
  jest.setTimeout(30000);

  beforeAll(async () => {
    testData.superCentralService = new CentralServerService(null, { email: config.get('superadmin.username'), password: config.get('superadmin.password') });
    testData.centralService = new CentralServerService(ContextDefinition.TENANT_CONTEXTS.TENANT_WITH_ALL_COMPONENTS, { email: config.get('admin.username'), password: config.get('admin.password') });
    testData.credentials.email = config.get('admin.username');
    // Retrieve the tenant id from the name
    const response = await testData.superCentralService.tenantApi.readAll({ 'Search': ContextDefinition.TENANT_CONTEXTS.TENANT_WITH_ALL_COMPONENTS }, TestConstants.DEFAULT_PAGING);
    testData.credentials.tenantId = response ? response.data.result[0].id : '';
    initialTenant = (await testData.superCentralService.tenantApi.readById(testData.credentials.tenantId)).data;

    testData.tenantContext = await ContextProvider.defaultInstance.getTenantContext(ContextDefinition.TENANT_CONTEXTS.TENANT_ORGANIZATION);
    testData.centralUserContext = testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN);
    testData.centralUserService = new CentralServerService(
      testData.tenantContext.getTenant().subdomain,
      testData.centralUserContext
    );
  });

  afterAll(async () => {
    // Housekeeping
    // Reset components before leaving
    const res = await testData.superCentralService.updateEntity(
      testData.centralService.tenantApi, initialTenant);
    expect(res.status).to.equal(StatusCodes.OK);
  });

  describe('Success cases (utall)', () => {
    it(
      'Check that retrieving refund settings filtered by identifier returns just one result',
      async () => {
        // Retrieve the setting id
        const read = await testData.centralService.settingApi.readByIdentifier({ 'Identifier': 'refund' });
        expect(read.status).to.equal(StatusCodes.OK);
        expect(read.data).to.not.be.null;
      }
    );
    it(
      'Check that retrieving pricing settings filtered by identifier returns just one result',
      async () => {
        // Retrieve the setting id
        const read = await testData.centralService.settingApi.readByIdentifier({ 'Identifier': 'pricing' });
        expect(read.status).to.equal(StatusCodes.OK);
        expect(read.data).to.not.be.null;
      }
    );
    it(
      'Check that retrieving organization settings filtered by identifier returns just one result',
      async () => {
        // Retrieve the setting id
        const read = await testData.centralService.settingApi.readByIdentifier({ 'Identifier': 'organization' });
        expect(read.status).to.equal(StatusCodes.OK);
        expect(read.data).to.not.be.null;
      }
    );
    it(
      'Check that retrieving analytics settings filtered by identifier returns just one result',
      async () => {
        // Retrieve the setting id
        const read = await testData.centralService.settingApi.readByIdentifier({ 'Identifier': 'analytics' });
        expect(read.status).to.equal(StatusCodes.OK);
        expect(read.data).to.not.be.null;
      }
    );
    it(
      'Check that retrieving ocpi settings filtered by identifier returns just one result',
      async () => {
        // Retrieve the setting id
        const read = await testData.centralService.settingApi.readByIdentifier({ 'Identifier': 'ocpi' });
        expect(read.status).to.equal(StatusCodes.OK);
        expect(read.data).to.not.be.null;
      }
    );
    it(
      'Check that retrieving statistics settings filtered by identifier returns just one result',
      async () => {
        // Retrieve the setting id
        const read = await testData.centralService.settingApi.readByIdentifier({ 'Identifier': 'statistics' });
        expect(read.status).to.equal(StatusCodes.OK);
        expect(read.data).to.not.be.null;
      }
    );
    it(
      'Check that retrieving crypto settings filtered by identifier returns one result',
      async () => {
        const read = await testData.centralService.settingApi.readByIdentifier({ 'Identifier': 'crypto' });
        expect(read.status).to.equal(StatusCodes.OK);
        expect(read.data).to.not.be.null;
      }
    );
    it('Check that retrieving setting by id is working', async () => {
      // Retrieve the setting id
      const read = await testData.centralService.settingApi.readAll({ 'Identifier': 'pricing' });
      expect(read.status).to.equal(StatusCodes.OK);
      const response = await testData.centralService.settingApi.readById(read.data.id);
      expect(response.status).to.equal(StatusCodes.OK);
    });

    describe('Crypto settings update tests', () => {
      beforeAll(async () => {
        await updatePricingWithSensitiveDataAndCheckResultSuccessful();
      });

      afterEach(async () => {
        await resetCryptoSettingToDefault();
      });

      it('Check crypto settings update - change key', async () => {
        const crtCryptoData = await getCurrentCryptoDataAndCheckResultSuccessful();
        await updateCryptoSettingsAndCheckResultSuccessful(crtCryptoData, crtCryptoData.content.crypto.keyProperties.blockCypher,
          crtCryptoData.content.crypto.keyProperties.blockSize, crtCryptoData.content.crypto.keyProperties.operationMode);

        // Get setting with sensitive data after crypto setting update
        const readSettingAfter = await testData.centralService.settingApi.readAll({ 'Identifier': 'refund' }, TestConstants.DEFAULT_PAGING);
        expect(readSettingAfter.status).to.equal(StatusCodes.OK);
        expect(readSettingAfter.data).to.not.be.null;

        // const clientSecretAfter = _.get(readSettingAfter.data, readSettingAfter.data.sensitiveData[0]);
      });
      it(
        'Check crypto settings update - change key + block size (256->128)',
        async () => {
          // Retrieve the crypto setting id
          const crtCryptoData = await getCurrentCryptoDataAndCheckResultSuccessful();
          // Ensure current block size is 256
          await updateCryptoSettingsAndCheckResultSuccessful(crtCryptoData, crtCryptoData.content.crypto.keyProperties.blockCypher,
            256, crtCryptoData.content.crypto.keyProperties.operationMode);
          // Update block size to 128
          await updateCryptoSettingsAndCheckResultSuccessful(crtCryptoData, crtCryptoData.content.crypto.keyProperties.blockCypher,
            128, crtCryptoData.content.crypto.keyProperties.operationMode);
        }
      );
      it(
        'Check crypto settings update - change key + block size (128->192)',
        async () => {
          // Retrieve the crypto setting id
          const crtCryptoData = await getCurrentCryptoDataAndCheckResultSuccessful();
          // Ensure current block size is 128
          await updateCryptoSettingsAndCheckResultSuccessful(crtCryptoData, crtCryptoData.content.crypto.keyProperties.blockCypher,
            128, crtCryptoData.content.crypto.keyProperties.operationMode);
          // Update block size to 192
          await updateCryptoSettingsAndCheckResultSuccessful(crtCryptoData, crtCryptoData.content.crypto.keyProperties.blockCypher,
            192, crtCryptoData.content.crypto.keyProperties.operationMode);
        }
      );
      it(
        'Check crypto settings update - change key + block size (192->128)',
        async () => {
          // Retrieve the crypto setting id
          const crtCryptoData = await getCurrentCryptoDataAndCheckResultSuccessful();
          // Ensure current block size is 192
          await updateCryptoSettingsAndCheckResultSuccessful(crtCryptoData, crtCryptoData.content.crypto.keyProperties.blockCypher,
            192, crtCryptoData.content.crypto.keyProperties.operationMode);
          // Update block size to 128
          await updateCryptoSettingsAndCheckResultSuccessful(crtCryptoData, crtCryptoData.content.crypto.keyProperties.blockCypher,
            128, crtCryptoData.content.crypto.keyProperties.operationMode);
        }
      );
      it(
        'Check crypto settings update - change key + block size (128->256)',
        async () => {
          // Retrieve the crypto setting id
          const crtCryptoData = await getCurrentCryptoDataAndCheckResultSuccessful();
          // Ensure current block size is 128
          await updateCryptoSettingsAndCheckResultSuccessful(crtCryptoData, crtCryptoData.content.crypto.keyProperties.blockCypher,
            128, crtCryptoData.content.crypto.keyProperties.operationMode);
          // Update block size to 256
          await updateCryptoSettingsAndCheckResultSuccessful(crtCryptoData, crtCryptoData.content.crypto.keyProperties.blockCypher,
            256, crtCryptoData.content.crypto.keyProperties.operationMode);
        }
      );
      it(
        'Check crypto settings update - change key + operation mode (gcm->ctr)',
        async () => {
          // Retrieve the crypto setting id
          const crtCryptoData = await getCurrentCryptoDataAndCheckResultSuccessful();
          // Ensure current operation mode is gcm
          await updateCryptoSettingsAndCheckResultSuccessful(crtCryptoData, crtCryptoData.content.crypto.keyProperties.blockCypher,
            crtCryptoData.content.crypto.keyProperties.blockSize, 'gcm');
          // Update operation mode to ctr
          await updateCryptoSettingsAndCheckResultSuccessful(crtCryptoData, crtCryptoData.content.crypto.keyProperties.blockCypher,
            crtCryptoData.content.crypto.keyProperties.blockSize, 'ctr');
        }
      );
      it(
        'Check crypto settings update - change key + algorithm (aes->aria)',
        async () => {
          // Retrieve the crypto setting id
          const crtCryptoData = await getCurrentCryptoDataAndCheckResultSuccessful();
          // Ensure current algorithm is aes + ensure operation mode works with both camellia & aes
          await updateCryptoSettingsAndCheckResultSuccessful(crtCryptoData, 'aes',
            crtCryptoData.content.crypto.keyProperties.blockSize, crtCryptoData.content.crypto.keyProperties.operationMode);
          // Update algorithm to camellia
          await updateCryptoSettingsAndCheckResultSuccessful(crtCryptoData, 'aria',
            crtCryptoData.content.crypto.keyProperties.blockSize, crtCryptoData.content.crypto.keyProperties.operationMode);
        }
      );
      it(
        'Check crypto settings update - change key + algorithm (aria->aes)',
        async () => {
          // Retrieve the crypto setting id
          const crtCryptoData = await getCurrentCryptoDataAndCheckResultSuccessful();
          // Ensure current algorithm is camellia + ensure operation mode works with both camellia & aes
          await updateCryptoSettingsAndCheckResultSuccessful(crtCryptoData, 'aria',
            crtCryptoData.content.crypto.keyProperties.blockSize, crtCryptoData.content.crypto.keyProperties.operationMode);
          // Update algorithm to aes
          await updateCryptoSettingsAndCheckResultSuccessful(crtCryptoData, 'aes',
            crtCryptoData.content.crypto.keyProperties.blockSize, crtCryptoData.content.crypto.keyProperties.operationMode);
        }
      );
      it(
        'Check crypto settings update - change key + operation mode (ctr->gcm)',
        async () => {
          // Retrieve the crypto setting id
          const crtCryptoData = await getCurrentCryptoDataAndCheckResultSuccessful();
          // Ensure current operation mode is ctr
          await updateCryptoSettingsAndCheckResultSuccessful(crtCryptoData, crtCryptoData.content.crypto.keyProperties.blockCypher,
            crtCryptoData.content.crypto.keyProperties.blockSize, 'ctr');
          // Update operation mode to gcm
          await updateCryptoSettingsAndCheckResultSuccessful(crtCryptoData, crtCryptoData.content.crypto.keyProperties.blockCypher,
            crtCryptoData.content.crypto.keyProperties.blockSize, 'gcm');
        }
      );
      it(
        'Check crypto settings update - change key + operation mode (gcm->ccm)',
        async () => {
          // Retrieve the crypto setting id
          const crtCryptoData = await getCurrentCryptoDataAndCheckResultSuccessful();
          // Ensure current operation mode is gcm
          await updateCryptoSettingsAndCheckResultSuccessful(crtCryptoData, crtCryptoData.content.crypto.keyProperties.blockCypher,
            crtCryptoData.content.crypto.keyProperties.blockSize, 'gcm');
          // Update operation mode to ccm
          await updateCryptoSettingsAndCheckResultSuccessful(crtCryptoData, crtCryptoData.content.crypto.keyProperties.blockCypher,
            crtCryptoData.content.crypto.keyProperties.blockSize, 'ccm');
        }
      );
      it(
        'Check crypto settings update - change key + operation mode (ccm->ctr)',
        async () => {
          // Retrieve the crypto setting id
          const crtCryptoData = await getCurrentCryptoDataAndCheckResultSuccessful();
          // Ensure current operation mode is ccm
          await updateCryptoSettingsAndCheckResultSuccessful(crtCryptoData, crtCryptoData.content.crypto.keyProperties.blockCypher,
            crtCryptoData.content.crypto.keyProperties.blockSize, 'ccm');
          // Update operation mode to ctr
          await updateCryptoSettingsAndCheckResultSuccessful(crtCryptoData, crtCryptoData.content.crypto.keyProperties.blockCypher,
            crtCryptoData.content.crypto.keyProperties.blockSize, 'ctr');
        }
      );
      it(
        'Check crypto settings update - change key + operation mode (ctr->ccm)',
        async () => {
          // Retrieve the crypto setting id
          const crtCryptoData = await getCurrentCryptoDataAndCheckResultSuccessful();
          // Ensure current operation mode is ctr
          await updateCryptoSettingsAndCheckResultSuccessful(crtCryptoData, crtCryptoData.content.crypto.keyProperties.blockCypher,
            crtCryptoData.content.crypto.keyProperties.blockSize, 'ctr');
          // Update operation mode to ccm
          await updateCryptoSettingsAndCheckResultSuccessful(crtCryptoData, crtCryptoData.content.crypto.keyProperties.blockCypher,
            crtCryptoData.content.crypto.keyProperties.blockSize, 'ccm');
        }
      );
      it(
        'Check crypto settings update - change key + operation mode (ccm->gcm)',
        async () => {
          // Retrieve the crypto setting id
          const crtCryptoData = await getCurrentCryptoDataAndCheckResultSuccessful();
          // Ensure current operation mode is ccm
          await updateCryptoSettingsAndCheckResultSuccessful(crtCryptoData, crtCryptoData.content.crypto.keyProperties.blockCypher,
            crtCryptoData.content.crypto.keyProperties.blockSize, 'ccm');
          // Update operation mode to gcm
          await updateCryptoSettingsAndCheckResultSuccessful(crtCryptoData, crtCryptoData.content.crypto.keyProperties.blockCypher,
            crtCryptoData.content.crypto.keyProperties.blockSize, 'gcm');
        }
      );
      it(
        'Check crypto settings update - change key + block size + operation mode (*-256-gcm -> *-128-ctr)',
        async () => {
          // Retrieve the crypto setting id
          const crtCryptoData = await getCurrentCryptoDataAndCheckResultSuccessful();
          // Ensure current encryption is *-256-gcm
          await updateCryptoSettingsAndCheckResultSuccessful(crtCryptoData, crtCryptoData.content.crypto.keyProperties.blockCypher, 256, 'gcm');
          // Update encryption to *-128-ctr
          await updateCryptoSettingsAndCheckResultSuccessful(crtCryptoData, crtCryptoData.content.crypto.keyProperties.blockCypher, 128, 'ctr');
        }
      );
      it(
        'Check crypto settings update - change key + block size + operation mode (*-128-ctr -> *-192-ccm)',
        async () => {
          // Retrieve the crypto setting id
          const crtCryptoData = await getCurrentCryptoDataAndCheckResultSuccessful();
          // Ensure current encryption is *-128-ctr
          await updateCryptoSettingsAndCheckResultSuccessful(crtCryptoData, crtCryptoData.content.crypto.keyProperties.blockCypher, 128, 'ctr');
          // Update encryption to *-192-ccm
          await updateCryptoSettingsAndCheckResultSuccessful(crtCryptoData, crtCryptoData.content.crypto.keyProperties.blockCypher, 192, 'ccm');
        }
      );
      it(
        'Check crypto settings update - change key + block size + operation mode (*-192-ccm -> *-256-ofb)',
        async () => {
          // Retrieve the crypto setting id
          const crtCryptoData = await getCurrentCryptoDataAndCheckResultSuccessful();
          // Ensure current encryption is *-192-ccm
          await updateCryptoSettingsAndCheckResultSuccessful(crtCryptoData, crtCryptoData.content.crypto.keyProperties.blockCypher, 192, 'ccm');
          // Update encryption to *-256-ofb
          await updateCryptoSettingsAndCheckResultSuccessful(crtCryptoData, crtCryptoData.content.crypto.keyProperties.blockCypher, 256, 'ofb');
        }
      );
      it(
        'Check crypto settings update - change key + algorithm + block size (aes-256-ofb -> camellia-128-ofb)',
        async () => {
          // Retrieve the crypto setting id
          const crtCryptoData = await getCurrentCryptoDataAndCheckResultSuccessful();
          // Ensure current encryption is aes-256-* + ensure operation mode works with both camellia & aes
          await updateCryptoSettingsAndCheckResultSuccessful(crtCryptoData, 'aes', 256, 'ofb');
          // Update encryption to camellia-128-*
          await updateCryptoSettingsAndCheckResultSuccessful(crtCryptoData, 'camellia', 128, 'ofb');
        }
      );
      it(
        'Check crypto settings update - change key + algorithm + block size (camellia-128-ofb -> aes-192-ofb)',
        async () => {
          // Retrieve the crypto setting id
          const crtCryptoData = await getCurrentCryptoDataAndCheckResultSuccessful();
          // Ensure current encryption is camellia-128-* + ensure operation mode works with both camellia & aes
          await updateCryptoSettingsAndCheckResultSuccessful(crtCryptoData, 'camellia', 128, 'ofb');
          // Update encryption to aes-192-*
          await updateCryptoSettingsAndCheckResultSuccessful(crtCryptoData, 'aes', 192, 'ofb');

        }
      );
      it(
        'Check crypto settings update - change key + algorithm + block size (aes-192-ofb -> camellia-256-ofb)',
        async () => {
          // Retrieve the crypto setting id
          const crtCryptoData = await getCurrentCryptoDataAndCheckResultSuccessful();
          // Ensure current encryption is aes-192-* + ensure operation mode works with both camellia & aes
          await updateCryptoSettingsAndCheckResultSuccessful(crtCryptoData, 'aes', 192, 'ofb');
          // Update encryption to camellia-256-*
          await updateCryptoSettingsAndCheckResultSuccessful(crtCryptoData, 'camellia', 256, 'ofb');
        }
      );
      it(
        'Check crypto settings update - change key + algorithm + block size (camellia-256-ofb -> aes-128-ofb)',
        async () => {
          // Retrieve the crypto setting id
          const crtCryptoData = await getCurrentCryptoDataAndCheckResultSuccessful();
          // Ensure current encryption is camellia-256-* + ensure operation mode works with both camellia & aes
          await updateCryptoSettingsAndCheckResultSuccessful(crtCryptoData, 'camellia', 256, 'ofb');
          // Update encryption to aes-128-*
          await updateCryptoSettingsAndCheckResultSuccessful(crtCryptoData, 'aes', 128, 'ofb');

        }
      );
      it(
        'Check crypto settings update - change key + algorithm + block size (aes-128-ofb -> camellia-192-ofb)',
        async () => {
          // Retrieve the crypto setting id
          const crtCryptoData = await getCurrentCryptoDataAndCheckResultSuccessful();
          // Ensure current encryption is aes-128-* + ensure operation mode works with both camellia & aes
          await updateCryptoSettingsAndCheckResultSuccessful(crtCryptoData, 'aes', 128, 'ofb');
          // Update encryption to camellia-192-*
          await updateCryptoSettingsAndCheckResultSuccessful(crtCryptoData, 'camellia', 192, 'ofb');
        }
      );
      it(
        'Check crypto settings update - change key + algorithm + operation mode (camellia-256-ofb -> aes-256-gcm)',
        async () => {
          // Retrieve the crypto setting id
          const crtCryptoData = await getCurrentCryptoDataAndCheckResultSuccessful();
          // Ensure current encryption is camellia-*-ofb
          await updateCryptoSettingsAndCheckResultSuccessful(crtCryptoData, 'camellia', crtCryptoData.content.crypto.keyProperties.blockSize, 'ofb');
          // Update encryption to aes-*-gcm
          await updateCryptoSettingsAndCheckResultSuccessful(crtCryptoData, 'aes', crtCryptoData.content.crypto.keyProperties.blockSize, 'gcm');
        }
      );
      it(
        'Check crypto settings update - change key + algorithm + operation mode (aes-256-gcm -> camellia-256-ctr)',
        async () => {
          // Retrieve the crypto setting id
          const crtCryptoData = await getCurrentCryptoDataAndCheckResultSuccessful();
          // Ensure current encryption is aes-*-gcm
          await updateCryptoSettingsAndCheckResultSuccessful(crtCryptoData, 'aes', crtCryptoData.content.crypto.keyProperties.blockSize, 'gcm');
          // Update encryption to camellia-*-ctr
          await updateCryptoSettingsAndCheckResultSuccessful(crtCryptoData, 'camellia', crtCryptoData.content.crypto.keyProperties.blockSize, 'ctr');
        }
      );
      it(
        'Check crypto settings update - change key + algorithm + operation mode (camellia-256-ctr -> aes-256-ccm)',
        async () => {
          // Retrieve the crypto setting id
          const crtCryptoData = await getCurrentCryptoDataAndCheckResultSuccessful();
          // Ensure current encryption is camellia-*-ctr
          await updateCryptoSettingsAndCheckResultSuccessful(crtCryptoData, 'camellia', crtCryptoData.content.crypto.keyProperties.blockSize, 'ctr');
          // Update encryption to aes-*-ccm
          await updateCryptoSettingsAndCheckResultSuccessful(crtCryptoData, 'aes', crtCryptoData.content.crypto.keyProperties.blockSize, 'ccm');
        }
      );

    });
  });

  describe('Error cases (utall)', () => {
    beforeAll(async () => {
      await updatePricingWithSensitiveDataAndCheckResultSuccessful();
    });

    afterEach(async () => {
      await resetCryptoSettingToDefault();
    });
    describe('Crypto settings tests', () => {
      it(
        'Check crypto settings update fails - CRYPTO_KEY_LENGTH_INVALID (513)',
        async () => {
          // Retrieve the crypto setting id
          const crtCryptoData = await getCurrentCryptoDataAndCheckResultSuccessful();
          // Update crypto setting
          const newKeyProperties: CryptoKeyProperties = {
            blockCypher: crtCryptoData.content.crypto.keyProperties.blockCypher,
            blockSize: crtCryptoData.content.crypto.keyProperties.blockSize,
            operationMode: crtCryptoData.content.crypto.keyProperties.operationMode
          };
          testData.data = getCryptoTestSettings(crtCryptoData, newKeyProperties);
          newKeyProperties.blockSize = 128;
          testData.data.content.crypto.key = Utils.generateRandomKey(newKeyProperties);
          try {
            await testData.centralService.updateEntity(testData.centralService.settingApi, testData.data);
          } catch (error) {
            expect(error.actual).to.equal(HTTPError.CRYPTO_KEY_LENGTH_INVALID);
          }
        }
      );
      it(
        'Check crypto settings update fails - CRYPTO_ALGORITHM_NOT_SUPPORTED (512)',
        async () => {
          // Retrieve the crypto setting id
          const crtCryptoData = await getCurrentCryptoDataAndCheckResultSuccessful();
          // Update crypto setting
          const newKeyProperties: CryptoKeyProperties = {
            blockCypher: 'camellia',
            blockSize: 192,
            operationMode: 'ccm'
          };
          testData.data = getCryptoTestSettings(crtCryptoData, newKeyProperties);
          testData.data.content.crypto.key = Utils.generateRandomKey(newKeyProperties);
          try {
            await testData.centralService.updateEntity(testData.centralService.settingApi, testData.data);
          } catch (error) {
            expect(error.actual).to.equal(HTTPError.CRYPTO_ALGORITHM_NOT_SUPPORTED);
          }
        }
      );
    });
  });

  describe('Settings authorization tests', () => {
    describe('With admin user', () => {
      it('Should be able to read all settings', async () => {
        const read = await testData.centralService.settingApi.readAll({}, TestConstants.DEFAULT_PAGING);
        expect(read.status).to.equal(StatusCodes.OK);
      });
      it('Should be able to read setting by identifier', async () => {
        const read = await testData.centralService.settingApi.readByIdentifier({ 'Identifier': 'pricing' });
        expect(read.status).to.equal(StatusCodes.OK);
        expect(read.data).to.not.be.null;
      });
      it('Should be able to read setting by id', async () => {
        const read = await testData.centralService.settingApi.readAll({ 'Identifier': 'pricing' }, TestConstants.DEFAULT_PAGING);
        expect(read.status).to.equal(StatusCodes.OK);
        const response = await testData.centralService.settingApi.readById(read.data.id);
        expect(response.status).to.equal(StatusCodes.OK);
      });
      it('Should be able to create a new setting', async () => {
        // Delete a previous setting as they all already exist
        const read = await testData.centralService.settingApi.readByIdentifier({ Identifier: 'statistics' });
        expect(read.status).to.eq(StatusCodes.OK);
        await testData.centralService.settingApi.delete(read.data.id);
        // Recreate it
        const settingData = {
          'identifier': 'statistics',
          'content': {}
        };
        const create = await testData.centralService.settingApi.create(settingData);
        expect(create.status).to.equal(StatusCodes.OK);
      });
      it('Should be able to delete the created setting', async () => {
        const read = await testData.centralService.settingApi.readByIdentifier({ 'Identifier': 'statistics' });
        const deleted = await testData.centralService.settingApi.delete(read.data.id);
        expect(deleted.status).to.equal(StatusCodes.OK);
        // Restore the statistics setting
        const settingData = {
          'identifier': 'statistics',
          'content': {}
        };
        const create = await testData.centralService.settingApi.create(settingData);
        expect(create.status).to.equal(StatusCodes.OK);
      });

      it('Should not be able to create an unknown setting', async () => {
        const settingData = {
          'identifier': 'unknown',
          'content': {}
        };
        const create = await testData.centralService.settingApi.create(settingData);
        expect(create.status).to.equal(StatusCodes.INTERNAL_SERVER_ERROR);
      });
    });

    describe('Settings authorization tests - basic user', () => {
      beforeAll(() => {
        testData.userContext = testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.BASIC_USER);
        if (testData.userContext === testData.centralUserContext) {
          testData.userService = testData.centralUserService;
        } else {
          testData.userService = new CentralServerService(
            testData.tenantContext.getTenant().subdomain,
            testData.userContext
          );
        }
      });

      it('Should not be able to read all settings', async () => {
        try {
          const read = await testData.userService.settingApi.readAll({}, TestConstants.DEFAULT_PAGING);
          // Expect empty list when not authorized
          expect(read.status).to.equal(StatusCodes.OK);
          expect(read.data.count).to.equal(0);
        } catch (error) {
          expect(error.actual).to.equal(StatusCodes.FORBIDDEN);
        }
      });
      it('Should be able to read setting by identifier', async () => {
        try {
          const read = await testData.userService.settingApi.readAll({ 'Identifier': 'crypto' }, TestConstants.DEFAULT_PAGING);
          expect(read.status).to.equal(StatusCodes.OK);
          expect(read.data.id).to.not.be.null;
        } catch (error) {
          expect(error.actual).to.equal(StatusCodes.FORBIDDEN);
        }
      });
      it('Should not be able to read setting with unknown id', async () => {
        try {
          const read = await testData.userService.settingApi.readById('5c6c8e8ee7fd060008215e30');
          expect(read.status).to.not.equal(StatusCodes.OK);
        } catch (error) {
          expect(error.actual).to.equal(StatusCodes.FORBIDDEN);
        }
      });
      it('Should not be able to create a new setting', async () => {
        const settingData = {
          'identifier': 'test',
          'content': {
            'type': 'simple'
          }
        };
        try {
          const create = await testData.userService.settingApi.create(settingData);
          expect(create.status).to.not.equal(StatusCodes.OK);
        } catch (error) {
          expect(error.actual).to.equal(StatusCodes.FORBIDDEN);
        }
      });
      it('Should not be able to update a setting', async () => {
        const settingData = {
          'identifier': 'test',
          'content': {
            'type': 'updated'
          }
        };
        try {
          const update = await testData.userService.settingApi.update(settingData);
          expect(update.status).to.not.equal(StatusCodes.OK);
        } catch (error) {
          expect(error.actual).to.equal(StatusCodes.FORBIDDEN);
        }
      });
      it('Should not be able to delete the created setting', async () => {
        try {
          const deleted = await testData.userService.settingApi.delete('5c6c8e8ee7fd060008215e30');
          expect(deleted.status).to.not.equal(StatusCodes.OK);
        } catch (error) {
          expect(error.actual).to.equal(StatusCodes.FORBIDDEN);
        }
      });
    });
  });
});
