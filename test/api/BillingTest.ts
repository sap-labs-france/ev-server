/* eslint-disable max-len */
import { BillingChargeInvoiceAction, BillingInvoiceStatus } from '../../src/types/Billing';
import { BillingSettings, BillingSettingsType } from '../../src/types/Setting';
import FeatureToggles, { Feature } from '../../src/utils/FeatureToggles';
import chai, { assert, expect } from 'chai';

import BillingTestData from './BillingTestData';
import CentralServerService from './client/CentralServerService';
import Constants from '../../src/utils/Constants';
import ContextDefinition from './context/ContextDefinition';
import ContextProvider from './context/ContextProvider';
import Factory from '../factories/Factory';
import MongoDBStorage from '../../src/storage/mongodb/MongoDBStorage';
import { StatusCodes } from 'http-status-codes';
import TestConstants from './client/utils/TestConstants';
import User from '../../src/types/User';
import { UserInErrorType } from '../../src/types/InError';
import chaiSubset from 'chai-subset';
import config from '../config';
import global from '../../src/types/GlobalType';
import responseHelper from '../helpers/responseHelper';

chai.use(chaiSubset);
chai.use(responseHelper);

const testData = new BillingTestData();

describe('Billing Settings', function() {
  // Do not run the tests when the settings are not properly set
  this.pending = !testData.isBillingProperlyConfigured();
  this.timeout(1000000);

  describe('With component Billing (utbilling)', () => {
    before(async () => {
      global.database = new MongoDBStorage(config.get('storage'));
      await global.database.start();
      testData.tenantContext = await ContextProvider.defaultInstance.getTenantContext(ContextDefinition.TENANT_CONTEXTS.TENANT_BILLING);
      testData.adminUserContext = testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN);
      testData.adminUserService = new CentralServerService(
        testData.tenantContext.getTenant().subdomain,
        testData.adminUserContext
      );
      expect(testData.userContext).to.not.be.null;
    });

    describe('As an admin - with transaction billing OFF', () => {
      // eslint-disable-next-line @typescript-eslint/require-await
      before(async () => {
        testData.initUserContextAsAdmin();
        // Initialize the Billing module with transaction billing ON
        testData.billingImpl = await testData.setBillingSystemValidCredentials(false);
      });

      it('Should be able to invoke Billing Settings endpoints', async () => {
        // Get the Billing settings
        let response = await testData.userService.billingApi.getBillingSetting();
        assert(response.status === StatusCodes.OK, 'Response status should be 200');
        const billingSettings = response.data as BillingSettings ;
        assert(billingSettings.billing, 'Billing Properties should not be null');
        assert(billingSettings.type === BillingSettingsType.STRIPE, 'Billing Setting Type should not be set to STRIPE');
        assert(billingSettings.stripe, 'Stripe Properties should not be null');
        assert(billingSettings.stripe.secretKey, 'Secret Key should not be null');
        assert(billingSettings.id, 'ID should not be null');
        // Check billing connection to STRIPE
        response = await testData.userService.billingApi.checkBillingConnection();
        assert(response.status === StatusCodes.OK, 'Response status should be 200');
        assert(response.data, 'Response data should not be null');
        assert(response.data.connectionIsValid === true, 'Connection should be valid');
      });

      it('Should be able to update the secret key', async () => {
        // Get the Billing settings
        let response = await testData.userService.billingApi.getBillingSetting();
        assert(response.status === StatusCodes.OK, 'Response status should be 200');
        let billingSettings = response.data as BillingSettings ;
        assert(billingSettings.billing, 'Billing Properties should not be null');
        assert(!billingSettings.billing.isTransactionBillingActivated, 'Transaction Billing should be OFF');
        assert(billingSettings.stripe.secretKey, 'Hash of the secret key should not be null');
        const keyHash = billingSettings.stripe.secretKey;
        // Let's attempt to update the secret key
        billingSettings.stripe.secretKey = config.get('stripe.secretKey'),
        response = await testData.userService.billingApi.updateBillingSetting(billingSettings);
        assert(response.status === StatusCodes.OK, 'Response status should be 200');
        // Check that the hash is still correct
        response = await testData.userService.billingApi.getBillingSetting();
        assert(response.status === StatusCodes.OK, 'Response status should be 200');
        billingSettings = response.data as BillingSettings ;
        assert(billingSettings.billing, 'Billing Properties should not be null');
        assert(keyHash !== billingSettings.stripe.secretKey, 'Hash of the secret key should be different');
      });

      it('Should check prerequisites when switching Transaction Billing ON', async () => {
        let response = await testData.userService.billingApi.getBillingSetting();
        assert(response.status === StatusCodes.OK, 'Response status should be 200');
        const billingSettings = response.data as BillingSettings ;
        // Let's attempt to switch ON the billing of transactions
        billingSettings.billing.isTransactionBillingActivated = true;
        response = await testData.userService.billingApi.updateBillingSetting(billingSettings);
        // taxID is not set - so the prerequisites are not met
        assert(response.status !== StatusCodes.OK, 'Response status should not be 200');
        // Check again the billing connection to STRIPE
        response = await testData.userService.billingApi.checkBillingConnection();
        assert(response.status === StatusCodes.OK, 'Response status should be 200');
        assert(response.data, 'Response data should not be null');
        assert(response.data.connectionIsValid === true, 'Connection should be valid');
      });
    });

    describe('As an admin - with transaction billing ON', () => {
      // eslint-disable-next-line @typescript-eslint/require-await
      before(async () => {
        testData.initUserContextAsAdmin();
        // Initialize the Billing module with transaction billing ON
        testData.billingImpl = await testData.setBillingSystemValidCredentials();
      });

      it('Should be able to invoke Billing Settings endpoints', async () => {
        // Get the Billing settings
        let response = await testData.userService.billingApi.getBillingSetting();
        assert(response.status === StatusCodes.OK, 'Response status should be 200');
        const billingSettings = response.data as BillingSettings ;
        assert(billingSettings.billing, 'Billing Properties should not be null');
        assert(billingSettings.type === BillingSettingsType.STRIPE, 'Billing Setting Type should not be set to STRIPE');
        assert(billingSettings.stripe, 'Stripe Properties should not be null');
        assert(billingSettings.stripe.secretKey, 'Secret Key should not be null');
        assert(billingSettings.id, 'ID should not be null');
        // Check billing connection to STRIPE
        response = await testData.userService.billingApi.checkBillingConnection();
        assert(response.status === StatusCodes.OK, 'Response status should be 200');
        assert(response.data, 'Response data should not be null');
        assert(response.data.connectionIsValid === true, 'Connection should be valid');
      });

      it('Should not be able to alter the secretKey when transaction billing is ON', async () => {
        // Get the Billing settings
        let response = await testData.userService.billingApi.getBillingSetting();
        assert(response.status === StatusCodes.OK, 'Response status should be 200');
        let billingSettings = response.data as BillingSettings ;
        assert(billingSettings.billing, 'Billing Properties should not be null');
        assert(billingSettings.billing.isTransactionBillingActivated, 'Transaction Billing should be ON');
        assert(billingSettings.stripe.secretKey, 'Hash of the secret key should not be null');
        const keyHash = billingSettings.stripe.secretKey;
        // Let's attempt to alter the secret key while transaction billing is ON
        billingSettings.stripe.secretKey = '1234567890';
        response = await testData.userService.billingApi.updateBillingSetting(billingSettings);
        // Here it does not fail - but the initial secret key should have been preserved!
        assert(response.status === StatusCodes.OK, 'Response status should be 200');
        // Check that the secret key was preserved
        response = await testData.userService.billingApi.getBillingSetting();
        assert(response.status === StatusCodes.OK, 'Response status should be 200');
        billingSettings = response.data as BillingSettings ;
        assert(billingSettings.billing, 'Billing Properties should not be null');
        assert(keyHash === billingSettings.stripe.secretKey, 'Hash of the secret key should not have changed');
        // Check again the billing connection to STRIPE
        response = await testData.userService.billingApi.checkBillingConnection();
        assert(response.status === StatusCodes.OK, 'Response status should be 200');
        assert(response.data, 'Response data should not be null');
        assert(response.data.connectionIsValid === true, 'Connection should be valid');
      });

      it('Should not be able to switch the transaction billing OFF', async () => {
        // Get the Billing settings
        let response = await testData.userService.billingApi.getBillingSetting();
        assert(response.status === StatusCodes.OK, 'Response status should be 200');
        const billingSettings = response.data as BillingSettings ;
        assert(billingSettings.billing, 'Billing Properties should not be null');
        assert(billingSettings.billing.isTransactionBillingActivated, 'Transaction Billing should be ON');
        // Let's attempt to switch the transaction billing OFF
        billingSettings.billing.isTransactionBillingActivated = false;
        response = await testData.userService.billingApi.updateBillingSetting(billingSettings);
        assert(response.status === StatusCodes.METHOD_NOT_ALLOWED, 'Response status should be 405');
        // Check again the billing connection to STRIPE
        response = await testData.userService.billingApi.checkBillingConnection();
        assert(response.status === StatusCodes.OK, 'Response status should be 200');
        assert(response.data, 'Response data should not be null');
        assert(response.data.connectionIsValid === true, 'Connection should be valid');
      });
    });
  });
});

describe('Billing Service', function() {
  // Do not run the tests when the settings are not properly set
  this.pending = !testData.isBillingProperlyConfigured();
  this.timeout(1000000);

  describe('With component Billing (utbilling)', () => {
    before(async () => {
      global.database = new MongoDBStorage(config.get('storage'));
      await global.database.start();
      await testData.initialize();
    });

    describe('with Transaction Billing ON', () => {
      before(async () => {
        // Initialize the charing station context
        await testData.initChargingStationContext();
        // Initialize the Billing module
        testData.billingImpl = await testData.setBillingSystemValidCredentials();
        // Make sure the required users are in sync
        const adminUser: User = testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN);
        const basicUser: User = testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.BASIC_USER);
        // Synchronize at least these 2 users - this creates a customer on the STRIPE side
        await testData.billingImpl.forceSynchronizeUser(adminUser);
        await testData.billingImpl.forceSynchronizeUser(basicUser);
      });

      xdescribe('Tune user profiles', () => {
        // eslint-disable-next-line @typescript-eslint/require-await
        before(async () => {
          testData.initUserContextAsAdmin();
        });

        it('Should change admin user locale to fr_FR', async () => {
          const user: User = testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN);
          const { id, email, name, firstName } = user;
          await testData.userService.updateEntity(testData.userService.userApi, { id, email, name, firstName, locale: 'fr_FR' }, true);
        });

        it('Should change basic user locale to es_ES', async () => {
          const user: User = testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.BASIC_USER);
          const { id, email, name, firstName } = user;
          await testData.userService.updateEntity(testData.userService.userApi, { id, email, name, firstName, locale: 'es_ES' }, true);
        });
      });

      describe('Where admin user (essential)', () => {
        // eslint-disable-next-line @typescript-eslint/require-await
        before(async () => {
          testData.initUserContextAsAdmin();
        });

        it('should add an item to a DRAFT invoice after a transaction', async () => {
          await testData.userService.billingApi.forceSynchronizeUser({ id: testData.userContext.id });
          const userWithBillingData = await testData.billingImpl.getUser(testData.userContext);
          await testData.assignPaymentMethod(userWithBillingData, 'tok_fr');
          const itemsBefore = await testData.getNumberOfSessions(testData.userContext.id);
          const transactionID = await testData.generateTransaction(testData.userContext);
          assert(transactionID, 'transactionID should not be null');
          // await testData.checkTransactionBillingData(transactionID); // TODO - Check not yet possible!
          // await testData.userService.billingApi.synchronizeInvoices({});
          const itemsAfter = await testData.getNumberOfSessions(testData.userContext.id);
          expect(itemsAfter).to.be.gt(itemsBefore);
        });
      });

      describe('Where admin user', () => {
        // eslint-disable-next-line @typescript-eslint/require-await
        before(async () => {
          testData.initUserContextAsAdmin();
        });

        it('Should connect to Billing Provider', async () => {
          const response = await testData.userService.billingApi.testConnection({}, TestConstants.DEFAULT_PAGING, TestConstants.DEFAULT_ORDERING);
          expect(response.data.connectionIsValid).to.be.true;
          expect(response.data).containSubset(Constants.REST_RESPONSE_SUCCESS);
        });

        it('Should create/update/delete a user', async () => {
          const fakeUser = {
            ...Factory.user.build(),
          } as User;
          fakeUser.issuer = true;
          // Let's create a user
          await testData.userService.createEntity(
            testData.userService.userApi,
            fakeUser
          );
          testData.createdUsers.push(fakeUser);
          // Let's check that the corresponding billing user exists as well (a Customer in the STRIPE DB)
          let billingUser = await testData.billingImpl.getUser(fakeUser);
          expect(billingUser).to.be.not.null;
          // Let's update the new user
          fakeUser.firstName = 'Test';
          fakeUser.name = 'NAME';
          fakeUser.issuer = true;
          await testData.userService.updateEntity(
            testData.userService.userApi,
            fakeUser,
            false
          );
          // Let's check that the corresponding billing user was updated as well
          billingUser = await testData.billingImpl.getUser(fakeUser);
          expect(billingUser.name).to.be.eq(fakeUser.firstName + ' ' + fakeUser.name);
          // Let's delete the user
          await testData.userService.deleteEntity(
            testData.userService.userApi,
            { id: testData.createdUsers[0].id }
          );
          // Verify that the corresponding billing user is gone
          const exists = await testData.billingImpl.isUserSynchronized(testData.createdUsers[0]);
          expect(exists).to.be.false;
          testData.createdUsers.shift();
        });

        it('should add an item to the existing invoice after a transaction', async () => {
          await testData.userService.billingApi.forceSynchronizeUser({ id: testData.userContext.id });
          const itemsBefore = await testData.getNumberOfSessions(testData.userContext.id);
          const transactionID = await testData.generateTransaction(testData.userContext);
          expect(transactionID).to.not.be.null;
          // await testData.userService.billingApi.synchronizeInvoices({});
          const itemsAfter = await testData.getNumberOfSessions(testData.userContext.id);
          expect(itemsAfter).to.be.eq(itemsBefore + 1);
        });

        xit('should synchronize 1 invoice after a transaction', async () => {
        // Synchronize Invoices is now deprecated
          await testData.userService.billingApi.synchronizeInvoices({});
          const transactionID = await testData.generateTransaction(testData.userContext);
          expect(transactionID).to.not.be.null;
          const response = await testData.userService.billingApi.synchronizeInvoices({});
          expect(response.data).containSubset(Constants.REST_RESPONSE_SUCCESS);
          expect(response.data.inSuccess).to.be.eq(1);
        });

        it('Should list invoices', async () => {
          const response = await testData.userService.billingApi.readInvoices({}, TestConstants.DEFAULT_PAGING, TestConstants.DEFAULT_ORDERING);
          expect(response.status).to.be.eq(StatusCodes.OK);
          expect(response.data.result.length).to.be.gt(0);
        });

        xit('Should list filtered invoices', async () => {
          const response = await testData.userService.billingApi.readInvoices({ Status: BillingInvoiceStatus.OPEN }, TestConstants.DEFAULT_PAGING, TestConstants.DEFAULT_ORDERING);
          expect(response.data.result.length).to.be.gt(0);
          for (const invoice of response.data.result) {
            expect(invoice.status).to.be.eq(BillingInvoiceStatus.OPEN);
          }
        });

        xit('Should synchronize invoices', async () => {
          const response = await testData.userService.billingApi.synchronizeInvoices({});
          expect(response.data).containSubset(Constants.REST_RESPONSE_SUCCESS);
        });

        xit('Should force a user synchronization', async () => {
          const fakeUser = {
            ...Factory.user.build(),
          } as User;
          fakeUser.issuer = true;
          testData.billingImpl = await testData.setBillingSystemValidCredentials();
          await testData.userService.createEntity(
            testData.userService.userApi,
            fakeUser
          );
          testData.createdUsers.push(fakeUser);
          fakeUser.billingData = {
            customerID: 'cus_utbilling_fake_user',
            liveMode: false,
            lastChangedOn: new Date(),
          }; // TODO - not supported anymore
          await testData.userService.updateEntity(
            testData.userService.userApi,
            fakeUser
          );
          await testData.userService.billingApi.forceSynchronizeUser({ id: fakeUser.id });
          const billingUserAfter = await testData.billingImpl.getUser(fakeUser);
          expect(fakeUser.billingData.customerID).to.not.be.eq(billingUserAfter.billingData.customerID);
        });
      });

      describe('Where basic user', () => {

        before(async () => {
          testData.billingImpl = await testData.setBillingSystemValidCredentials();
          testData.userContext = testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.BASIC_USER);
          testData.userService = new CentralServerService(
            testData.tenantContext.getTenant().subdomain,
            testData.userContext
          );
          expect(testData.userService).to.not.be.null;
        });

        it('Should not be able to test connection to Billing Provider', async () => {
          const response = await testData.userService.billingApi.testConnection({}, TestConstants.DEFAULT_PAGING, TestConstants.DEFAULT_ORDERING);
          expect(response.status).to.be.eq(StatusCodes.FORBIDDEN);
        });

        it('Should not synchronize a user', async () => {
          const fakeUser = {
            ...Factory.user.build(),
          } as User;
          const response = await testData.userService.billingApi.synchronizeUser({ id: fakeUser.id });
          expect(response.status).to.be.eq(StatusCodes.FORBIDDEN);
        });

        it('Should not force synchronization of a user', async () => {
          const fakeUser = {
            ...Factory.user.build(),
          } as User;
          const response = await testData.userService.billingApi.forceSynchronizeUser({ id: fakeUser.id });
          expect(response.status).to.be.eq(StatusCodes.FORBIDDEN);
        });

        it('Should create an invoice after a transaction', async () => {
          const adminUser = testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN);
          const basicUser = testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.BASIC_USER);
          // Connect as Admin to Force synchronize basic user
          testData.userContext = adminUser;
          testData.userService = new CentralServerService(
            testData.tenantContext.getTenant().subdomain,
            testData.userContext
          );
          await testData.userService.billingApi.forceSynchronizeUser({ id: basicUser.id });
          // Reconnect as Basic user
          testData.userContext = basicUser;
          testData.userService = new CentralServerService(
            testData.tenantContext.getTenant().subdomain,
            testData.userContext
          );
          // await testData.userService.billingApi.synchronizeInvoices({});
          const userWithBillingData = await testData.billingImpl.getUser(testData.userContext);
          await testData.assignPaymentMethod(userWithBillingData, 'tok_fr');
          const itemsBefore = await testData.getNumberOfSessions(basicUser.id);
          const transactionID = await testData.generateTransaction(testData.userContext);
          assert(transactionID, 'transactionID should not be null');
          // await testData.userService.billingApi.synchronizeInvoices({});
          const itemsAfter = await testData.getNumberOfSessions(basicUser.id);
          expect(itemsAfter).to.be.eq(itemsBefore + 1);
        });
      });

      describe('Negative tests as an admin user', () => {
        // eslint-disable-next-line @typescript-eslint/require-await
        before(async () => {
          testData.initUserContextAsAdmin();
        });

        it('should not delete a transaction linked to an invoice', async () => {
          const transactionID = await testData.generateTransaction(testData.userContext);
          expect(transactionID).to.not.be.null;
          const transactionDeleted = await testData.userService.transactionApi.delete(transactionID);
          expect(transactionDeleted.data.inError).to.be.eq(1);
          expect(transactionDeleted.data.inSuccess).to.be.eq(0);
        });
      });

      describe('Recovery Scenarios', () => {
        // eslint-disable-next-line @typescript-eslint/require-await
        before(async () => {
          testData.initUserContextAsAdmin();
        });

        after(async () => {
        // Restore VALID STRIPE credentials
          testData.billingImpl = await testData.setBillingSystemValidCredentials();
        });

        it('Should recover after a synchronization issue', async () => {
          const fakeUser = {
            ...Factory.user.build(),
          } as User;
          fakeUser.issuer = true;
          testData.billingImpl = await testData.setBillingSystemInvalidCredentials();
          assert(testData.billingImpl, 'Billing implementation should not be null');
          await testData.userService.createEntity(
            testData.userService.userApi,
            fakeUser
          );
          testData.createdUsers.push(fakeUser);
          testData.billingImpl = await testData.setBillingSystemValidCredentials();
          await testData.userService.billingApi.synchronizeUser({ id: fakeUser.id });
          const userExists = await testData.billingImpl.isUserSynchronized(fakeUser);
          expect(userExists).to.be.true;
        });
      });

      describe('Negative tests - Wrong Billing Settings', () => {
        // eslint-disable-next-line @typescript-eslint/require-await
        before(async () => {
          testData.initUserContextAsAdmin();
          // Force INVALID STRIPE credentials
          testData.billingImpl = await testData.setBillingSystemInvalidCredentials();
          assert(testData.billingImpl, 'Billing implementation should not be null');
        });

        after(async () => {
        // Restore VALID STRIPE credentials
          testData.billingImpl = await testData.setBillingSystemValidCredentials();
        });

        it('Should not be able to start a transaction', async () => {
          const transactionID = await testData.generateTransaction(testData.userContext, 'Invalid');
          assert(!transactionID, 'Transaction ID should not be set');
        });

        it('Should set in error users without Billing data', async () => {
          const fakeUser = {
            ...Factory.user.build()
          } as User;
          fakeUser.issuer = true;
          // Creates user without billing data
          await testData.userService.createEntity(
            testData.userService.userApi,
            fakeUser
          );
          testData.createdUsers.push(fakeUser);
          // Check if user is in Users In Error
          const response = await testData.userService.userApi.readAllInError({ ErrorType: UserInErrorType.NO_BILLING_DATA }, {
            limit: 100,
            skip: 0
          });
          let userFound = false;
          for (const user of response.data.result) {
            if (user.id === fakeUser.id) {
              userFound = true;
              break;
            }
          }
          if (FeatureToggles.isFeatureActive(Feature.BILLING_SYNC_USERS)) {
            assert(userFound, 'User with no billing data should be listed as a User In Error');
          } else {
          // LAZY User Sync - The billing data will be created on demand (i.e.: when entering a payment method)
            assert(!userFound, 'User with no billing data should not be listed as a User In Error');
          }
        });

      });

      describe('Negative tests', () => {
        // eslint-disable-next-line @typescript-eslint/require-await
        before(async () => {
          testData.initUserContextAsAdmin();
          // Set STRIPE credentials
          testData.billingImpl = await testData.setBillingSystemInvalidCredentials();
        });

        after(async () => {
        });

        xit('Should set a transaction in error', async () => {
          const transactionID = await testData.generateTransaction(testData.userContext);
          const transactions = await testData.userService.transactionApi.readAllInError({});
          expect(transactions.data.result.find((transaction) => transaction.id === transactionID)).to.not.be.null;
        });

      });

    });

    describe('with Transaction Billing OFF', () => {
      before(async () => {
        expect(testData.userContext).to.not.be.null;
        await testData.initChargingStationContext();
        // Initialize the Billing module
        testData.billingImpl = await testData.setBillingSystemValidCredentials(false);
      });

      describe('Where admin user', () => {
        // eslint-disable-next-line @typescript-eslint/require-await
        before(async () => {
          testData.initUserContextAsAdmin();
        });

        it('should NOT add an item to a DRAFT invoice after a transaction', async () => {
          await testData.userService.billingApi.forceSynchronizeUser({ id: testData.userContext.id });
          // const userWithBillingData = await testData.billingImpl.getUser(testData.userContext);
          // await testData.assignPaymentMethod(userWithBillingData, 'tok_fr');
          const itemsBefore = await testData.getNumberOfSessions(testData.userContext.id);
          const transactionID = await testData.generateTransaction(testData.userContext);
          assert(transactionID, 'transactionID should not be null');
          // await testData.userService.billingApi.synchronizeInvoices({});
          const itemsAfter = await testData.getNumberOfSessions(testData.userContext.id);
          expect(itemsAfter).to.be.eq(itemsBefore);
        });

      });
    });


    describe('with Pricing + Billing', () => {
      before(async () => {
        testData.initUserContextAsAdmin();
        // Initialize the Billing module
        testData.billingImpl = await testData.setBillingSystemValidCredentials(true, true /* immediateBillingAllowed ON */);
      });

      describe('FF + CT', () => {
        // eslint-disable-next-line @typescript-eslint/require-await
        before(async () => {
          // Initialize the charing station context
          await testData.initChargingStationContext2TestChargingTime();
        });

        it('should create and bill an invoice with FF + CT', async () => {
          await testData.userService.billingApi.forceSynchronizeUser({ id: testData.userContext.id });
          const userWithBillingData = await testData.billingImpl.getUser(testData.userContext);
          await testData.assignPaymentMethod(userWithBillingData, 'tok_fr');
          const transactionID = await testData.generateTransaction(testData.userContext);
          assert(transactionID, 'transactionID should not be null');
          // Check that we have a new invoice with an invoiceID and an invoiceNumber
          await testData.checkTransactionBillingData(transactionID, BillingInvoiceStatus.PAID, 1.29);
        });

      });

      describe('FF + ENERGY', () => {
        // eslint-disable-next-line @typescript-eslint/require-await
        before(async () => {
        });

        it('should create and bill an invoice with FF + ENERGY', async () => {
          await testData.initChargingStationContext2TestCS3Phased();
          await testData.userService.billingApi.forceSynchronizeUser({ id: testData.userContext.id });
          const userWithBillingData = await testData.billingImpl.getUser(testData.userContext);
          await testData.assignPaymentMethod(userWithBillingData, 'tok_fr');
          const transactionID = await testData.generateTransaction(testData.userContext);
          assert(transactionID, 'transactionID should not be null');
          // Check that we have a new invoice with an invoiceID and an invoiceNumber
          await testData.checkTransactionBillingData(transactionID, BillingInvoiceStatus.PAID, 10.08);
        });

        it('should create and bill an invoice with FF+ENERGY(STEP)', async () => {
          await testData.initChargingStationContext2TestCS3Phased('FF+E(STEP)');
          await testData.userService.billingApi.forceSynchronizeUser({ id: testData.userContext.id });
          const userWithBillingData = await testData.billingImpl.getUser(testData.userContext);
          await testData.assignPaymentMethod(userWithBillingData, 'tok_fr');
          const transactionID = await testData.generateTransaction(testData.userContext);
          assert(transactionID, 'transactionID should not be null');
          // Check that we have a new invoice with an invoiceID and an invoiceNumber
          await testData.checkTransactionBillingData(transactionID, BillingInvoiceStatus.PAID, 9.50);
        });
      });

      describe('On COMBO CCS - DC', () => {
      // eslint-disable-next-line @typescript-eslint/require-await
        before(async () => {
        });

        it('should bill the Energy on COMBO CCS - DC', async () => {
          await testData.initChargingStationContext2TestFastCharger();
          await testData.userService.billingApi.forceSynchronizeUser({ id: testData.userContext.id });
          const userWithBillingData = await testData.billingImpl.getUser(testData.userContext);
          await testData.assignPaymentMethod(userWithBillingData, 'tok_fr');
          const transactionID = await testData.generateTransaction(testData.userContext);
          assert(transactionID, 'transactionID should not be null');
          // Check that we have a new invoice with an invoiceID and an invoiceNumber
          await testData.checkTransactionBillingData(transactionID, BillingInvoiceStatus.PAID, 16.16);
        });

        it('should bill the FF+CT+PT on COMBO CCS - DC', async () => {
          await testData.initChargingStationContext2TestFastCharger('FF+CT+PT');
          await testData.userService.billingApi.forceSynchronizeUser({ id: testData.userContext.id });
          const userWithBillingData = await testData.billingImpl.getUser(testData.userContext);
          await testData.assignPaymentMethod(userWithBillingData, 'tok_fr');
          const transactionID = await testData.generateTransaction(testData.userContext);
          assert(transactionID, 'transactionID should not be null');
          // Check that we have a new invoice with an invoiceID and an invoiceNumber
          await testData.checkTransactionBillingData(transactionID, BillingInvoiceStatus.PAID, 6.49);
        });

        it('should bill the CT(STEP)+PT(STEP) on COMBO CCS - DC', async () => {
          await testData.initChargingStationContext2TestFastCharger('CT(STEP)+PT(STEP)');
          await testData.userService.billingApi.forceSynchronizeUser({ id: testData.userContext.id });
          const userWithBillingData = await testData.billingImpl.getUser(testData.userContext);
          await testData.assignPaymentMethod(userWithBillingData, 'tok_fr');
          const transactionID = await testData.generateTransaction(testData.userContext);
          assert(transactionID, 'transactionID should not be null');
          // Check that we have a new invoice with an invoiceID and an invoiceNumber
          await testData.checkTransactionBillingData(transactionID, BillingInvoiceStatus.PAID, 11.00);
        });

        it('should bill the ENERGY + PT(STEP) on COMBO CCS - DC', async () => {
          await testData.initChargingStationContext2TestFastCharger('E+PT(STEP)');
          await testData.userService.billingApi.forceSynchronizeUser({ id: testData.userContext.id });
          const userWithBillingData = await testData.billingImpl.getUser(testData.userContext);
          await testData.assignPaymentMethod(userWithBillingData, 'tok_fr');
          const transactionID = await testData.generateTransaction(testData.userContext);
          assert(transactionID, 'transactionID should not be null');
          // Check that we have a new invoice with an invoiceID and an invoiceNumber
          await testData.checkTransactionBillingData(transactionID, BillingInvoiceStatus.PAID, 19.49);
        });

        it('should bill the FF+E with 2 tariffs on COMBO CCS - DC', async () => {
          // A first Tariff for the ENERGY Only
          await testData.initChargingStationContext2TestFastCharger('FF+E');
          // A second Tariff applied after 30 mins!
          await testData.initChargingStationContext2TestFastCharger('E-After30mins');
          // A tariff applied immediately
          await testData.userService.billingApi.forceSynchronizeUser({ id: testData.userContext.id });
          const userWithBillingData = await testData.billingImpl.getUser(testData.userContext);
          await testData.assignPaymentMethod(userWithBillingData, 'tok_fr');
          const transactionID = await testData.generateTransaction(testData.userContext);
          assert(transactionID, 'transactionID should not be null');
          // Check that we have a new invoice with an invoiceID and an invoiceNumber
          await testData.checkTransactionBillingData(transactionID, BillingInvoiceStatus.PAID, 24.63);
        });

        it('should bill the FF+E(STEP)+E(STEP) with 2 tariffs on COMBO CCS - DC', async () => {
          // A first Tariff for the ENERGY Only
          await testData.initChargingStationContext2TestFastCharger('FF+E(STEP)-MainTariff');
          // A second Tariff applied after 30 mins!
          await testData.initChargingStationContext2TestFastCharger('E(STEP)-After30mins');
          // A tariff applied immediately
          await testData.userService.billingApi.forceSynchronizeUser({ id: testData.userContext.id });
          const userWithBillingData = await testData.billingImpl.getUser(testData.userContext);
          await testData.assignPaymentMethod(userWithBillingData, 'tok_fr');
          const transactionID = await testData.generateTransaction(testData.userContext);
          assert(transactionID, 'transactionID should not be null');
          // Check that we have a new invoice with an invoiceID and an invoiceNumber
          await testData.checkTransactionBillingData(transactionID, BillingInvoiceStatus.PAID, 25);
        });

        it('should bill the FF+E+E(STEP) with 2 tariffs on COMBO CCS - DC', async () => {
          // A first Tariff for the ENERGY Only
          await testData.initChargingStationContext2TestFastCharger('FF+E');
          // A second Tariff applied after 30 mins!
          await testData.initChargingStationContext2TestFastCharger('E(STEP)-After30mins');
          // A tariff applied immediately
          await testData.userService.billingApi.forceSynchronizeUser({ id: testData.userContext.id });
          const userWithBillingData = await testData.billingImpl.getUser(testData.userContext);
          await testData.assignPaymentMethod(userWithBillingData, 'tok_fr');
          const transactionID = await testData.generateTransaction(testData.userContext);
          assert(transactionID, 'transactionID should not be null');
          // Check that we have a new invoice with an invoiceID and an invoiceNumber
          await testData.checkTransactionBillingData(transactionID, BillingInvoiceStatus.PAID, 17.37);
        });

      });


      describe('When basic user has a free access', () => {
        // eslint-disable-next-line @typescript-eslint/require-await
        before(async () => {
          testData.billingImpl = await testData.setBillingSystemValidCredentials();
          testData.adminUserContext = await testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN);
          expect(testData.adminUserContext).to.not.be.null;
          testData.userContext = testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.BASIC_USER);
          testData.userService = new CentralServerService(
            testData.tenantContext.getTenant().subdomain,
            testData.userContext
          );
          testData.adminUserService = new CentralServerService(
            testData.tenantContext.getTenant().subdomain,
            testData.adminUserContext
          );
          expect(testData.userService).to.not.be.null;
          // Update the freeAccess flag for the basic user:
          await testData.adminUserService.userApi.update({
            id: ContextDefinition.TENANT_USER_LIST[2].id,
            freeAccess: true
          });
        });

        it('should NOT add an item to a DRAFT invoice after a transaction', async () => {
          await testData.userService.billingApi.forceSynchronizeUser({ id: testData.userContext.id });
          const userWithBillingData = await testData.billingImpl.getUser(testData.userContext);
          await testData.assignPaymentMethod(userWithBillingData, 'tok_fr');
          const itemsBefore = await testData.getNumberOfSessions(testData.userContext.id);
          const transactionID = await testData.generateTransaction(testData.userContext);
          assert(transactionID, 'transactionID should not be null');
          // await testData.checkTransactionBillingData(transactionID); // TODO - Check not yet possible!
          // await testData.userService.billingApi.synchronizeInvoices({});
          const itemsAfter = await testData.getNumberOfSessions(testData.userContext.id);
          expect(itemsAfter).eq(itemsBefore);
        });
      });

      describe('When basic user does not have a free access', () => {
        // eslint-disable-next-line @typescript-eslint/require-await
        before(async () => {
          testData.billingImpl = await testData.setBillingSystemValidCredentials();
          testData.adminUserContext = await testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN);
          expect(testData.adminUserContext).to.not.be.null;
          testData.userContext = testData.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.BASIC_USER);
          testData.userService = new CentralServerService(
            testData.tenantContext.getTenant().subdomain,
            testData.userContext
          );
          testData.adminUserService = new CentralServerService(
            testData.tenantContext.getTenant().subdomain,
            testData.adminUserContext
          );
          expect(testData.userService).to.not.be.null;
          // Update the freeAccess flag for the basic user:
          await testData.adminUserService.userApi.update({
            id: ContextDefinition.TENANT_USER_LIST[2].id,
            freeAccess: false
          });
        });

        it('should add an item to a DRAFT invoice after a transaction', async () => {
          await testData.userService.billingApi.forceSynchronizeUser({ id: testData.userContext.id });
          // const userWithBillingData = await testData.billingImpl.getUser(testData.userContext);
          // await testData.assignPaymentMethod(userWithBillingData, 'tok_fr');
          const itemsBefore = await testData.getNumberOfSessions(testData.userContext.id);
          const transactionID = await testData.generateTransaction(testData.userContext);
          assert(transactionID, 'transactionID should not be null');
          // await testData.checkTransactionBillingData(transactionID); // TODO - Check not yet possible!
          // await testData.userService.billingApi.synchronizeInvoices({});
          const itemsAfter = await testData.getNumberOfSessions(testData.userContext.id);
          expect(itemsAfter).to.be.gt(itemsBefore);
        });
      });

    });

    describe('with Transaction Billing + Periodic Billing ON', () => {
      before(async () => {
        testData.initUserContextAsAdmin();
        // Initialize the Billing module
        testData.billingImpl = await testData.setBillingSystemValidCredentials(true, false /* immediateBillingAllowed OFF, so periodicBilling ON */);
      });

      describe('Where admin user', () => {
      // eslint-disable-next-line @typescript-eslint/require-await
        before(async () => {
          // Initialize the charing station context
          await testData.initChargingStationContext2TestChargingTime();
        });

        it('should create a DRAFT invoice, Finalize it and Pay it', async () => {
          await testData.userService.billingApi.forceSynchronizeUser({ id: testData.userContext.id });
          const userWithBillingData = await testData.billingImpl.getUser(testData.userContext);
          await testData.assignPaymentMethod(userWithBillingData, 'tok_fr');
          const transactionID = await testData.generateTransaction(testData.userContext);
          assert(transactionID, 'transactionID should not be null');
          // Check that we have a new invoice with an invoiceID and but no invoiceNumber yet
          await testData.checkTransactionBillingData(transactionID, BillingInvoiceStatus.DRAFT);
          // Let's simulate the periodic billing operation
          const operationResult: BillingChargeInvoiceAction = await testData.billingImpl.chargeInvoices(true /* forceOperation */);
          assert(operationResult.inSuccess > 0, 'The operation should have been able to process at least one invoice');
          assert(operationResult.inError === 0, 'The operation should detect any errors');
          // The transaction should now have a different status and know the final invoice number
          await testData.checkTransactionBillingData(transactionID, BillingInvoiceStatus.PAID);
          // The user should have no DRAFT invoices
          const nbDraftInvoices = await testData.checkForDraftInvoices();
          assert(nbDraftInvoices === 0, 'The expected number of DRAFT invoices is not correct');
        });

      });
    });

    xdescribe('Pricing Definition', () => {
      before(async () => {
      });

      after(async () => {
      });

      it('check CRUD operations on a Pricing Model', async () => {
        await testData.checkPricingDefinitionEndpoints();
      });
    });
  });

});
