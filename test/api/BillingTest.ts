/* eslint-disable max-len */
import { BillingAccount, BillingAccountStatus, BillingChargeInvoiceAction, BillingInvoiceStatus } from '../../src/types/Billing';
import { BillingPlatformFeeStrategyFactory, BillingTransferFactory } from '../factories/BillingFactory';
import { BillingSettings, BillingSettingsType } from '../../src/types/Setting';
import chai, { expect } from 'chai';

import { BillingPeriodicOperationTaskConfig } from '../../src/types/TaskConfig';
import BillingStorage from '../../src/storage/mongodb/BillingStorage';
import BillingTestHelper from './BillingTestHelper';
import CentralServerService from './client/CentralServerService';
import CompanyFactory from '../factories/CompanyFactory';
import Constants from '../../src/utils/Constants';
import ContextDefinition from './context/ContextDefinition';
import ContextProvider from './context/ContextProvider';
import Factory from '../factories/Factory';
import MongoDBStorage from '../../src/storage/mongodb/MongoDBStorage';
import SiteFactory from '../factories/SiteFactory';
import { StatusCodes } from 'http-status-codes';
import StripeTestHelper from './StripeTestHelper';
import TestConstants from './client/utils/TestConstants';
import User from '../../src/types/User';
import assert from 'assert';
import chaiSubset from 'chai-subset';
import config from '../config';
import global from '../../src/types/GlobalType';
import moment from 'moment';
import responseHelper from '../helpers/responseHelper';

chai.use(chaiSubset);
chai.use(responseHelper);

const stripeTestHelper = new StripeTestHelper();
const billingTestHelper = new BillingTestHelper();
// Conditional test execution function
const describeif = (condition) => condition ? describe : describe.skip;
// Do not run the tests when the settings are not properly set
const isBillingProperlyConfigured = stripeTestHelper.isBillingProperlyConfigured();

describeif(isBillingProperlyConfigured)('Billing', () => {
  // Do not run the tests when the settings are not properly set
  jest.setTimeout(1000000);

  beforeAll(async () => {
    global.database = new MongoDBStorage(config.get('storage'));
    await global.database.start();
  });

  describe('Billing Stripe Service (utbilling)', () => {
    beforeAll(async () => {
      await stripeTestHelper.initialize();
    });

    describe('immediate billing OFF', () => {
      beforeAll(async () => {
        const immediateBilling = false;
        await stripeTestHelper.forceBillingSettings(immediateBilling);
      });

      afterAll(async () => {
        // Cleanup of the utbilling tenant is useless
        // Anyway, there is no way to cleanup the utbilling stripe account!
      });

      it('should create a DRAFT invoice and fail to pay, and try again', async () => {
        await stripeTestHelper.checkBusinessProcessBillToPay(true);
        await stripeTestHelper.assignPaymentMethod('tok_visa');
        await stripeTestHelper.checkBusinessProcessRetryPayment();
      });

      // it('Should add a payment method to BILLING-TEST user', async () => {
      //   await stripeTestHelper.assignPaymentMethod('tok_visa');
      // });

      it(
        'should create a DRAFT invoice and pay it for BILLING-TEST user',
        async () => {
          await stripeTestHelper.checkBusinessProcessBillToPay(false, true);
        }
      );
    });

    describe('immediate billing ON', () => {
      beforeAll(async () => {
        /* ------------------------------------------------------
          Billing settings are forced to check the complete flow
          Invoice State - DRAFT => OPEN => PAID
          -------------------------------------------------------*/
        const immediateBilling = true;
        await stripeTestHelper.forceBillingSettings(immediateBilling);
      });

      describe('Sub-accounts', () => {
        it('Should create a sub-account with its associated activation link', async () => {
          const subAccount = await stripeTestHelper.createSubAccount();
          expect(subAccount.accountExternalID).to.exist;
          expect(subAccount.activationLink).to.include('https://connect.stripe.com/setup/s/');
          expect(subAccount.status).to.be.eq(BillingAccountStatus.IDLE);
        });
      });

      it('Should add a different source to BILLING-TEST user', async () => {
        await stripeTestHelper.assignPaymentMethod('tok_fr');
      });

      it(
        'should create and pay a second invoice for BILLING-TEST user',
        async () => {
          await stripeTestHelper.checkImmediateBillingWithTaxes();
        }
      );

      // TODO : change this as soon as we can test pm - now it's sources, not pm
      it('Should detach newly added source to BILLING-TEST user', async () => {
        const newSource = await stripeTestHelper.assignPaymentMethod('tok_fr');
        await stripeTestHelper.checkDetachPaymentMethod(newSource.id);
      });

      it('should be able to repair a user', async () => {
        await stripeTestHelper.checkRepairInconsistencies();
      });

    });
  });

  describe('Billing Settings (utbilling)', () => {
    beforeAll(async () => {
      billingTestHelper.tenantContext = await ContextProvider.defaultInstance.getTenantContext(ContextDefinition.TENANT_CONTEXTS.TENANT_BILLING);
      billingTestHelper.adminUserContext = billingTestHelper.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN);
      billingTestHelper.adminUserService = new CentralServerService(
        billingTestHelper.tenantContext.getTenant().subdomain,
        billingTestHelper.adminUserContext
      );
      expect(billingTestHelper.userContext).to.not.be.null;
    });

    describe('As an admin - with transaction billing OFF', () => {
      // eslint-disable-next-line @typescript-eslint/require-await
      beforeAll(async () => {
        billingTestHelper.initUserContextAsAdmin();
        // Initialize the Billing module with transaction billing ON
        billingTestHelper.billingImpl = await billingTestHelper.setBillingSystemValidCredentials(false);
      });

      it('Should be able to invoke Billing Settings endpoints', async () => {
        // Get the Billing settings
        let response = await billingTestHelper.userService.billingApi.getBillingSetting();
        assert(response.status === StatusCodes.OK, 'Response status should be 200');
        const billingSettings = response.data as BillingSettings ;
        assert(billingSettings.billing, 'Billing Properties should not be null');
        assert(billingSettings.type === BillingSettingsType.STRIPE, 'Billing Setting Type should not be set to STRIPE');
        assert(billingSettings.stripe, 'Stripe Properties should not be null');
        assert(billingSettings.stripe.secretKey, 'Secret Key should not be null');
        assert(billingSettings.id, 'ID should not be null');
        // Check billing connection to STRIPE
        response = await billingTestHelper.userService.billingApi.checkBillingConnection();
        assert(response.status === StatusCodes.OK, 'Response status should be 200');
        assert(response.data, 'Response data should not be null');
        assert(response.data.connectionIsValid === true, 'Connection should be valid');
      });

      it('Should be able to update the secret key', async () => {
        // Get the Billing settings
        let response = await billingTestHelper.userService.billingApi.getBillingSetting();
        assert(response.status === StatusCodes.OK, 'Response status should be 200');
        let billingSettings = response.data as BillingSettings ;
        assert(billingSettings.billing, 'Billing Properties should not be null');
        assert(!billingSettings.billing.isTransactionBillingActivated, 'Transaction Billing should be OFF');
        assert(billingSettings.stripe.secretKey, 'Hash of the secret key should not be null');
        const keyHash = billingSettings.stripe.secretKey;
        // Let's attempt to update the secret key
        billingSettings.stripe.secretKey = config.get('stripe.secretKey'),
        response = await billingTestHelper.userService.billingApi.updateBillingSetting(billingSettings);
        assert(response.status === StatusCodes.OK, 'Response status should be 200');
        // Check that the hash is still correct
        response = await billingTestHelper.userService.billingApi.getBillingSetting();
        assert(response.status === StatusCodes.OK, 'Response status should be 200');
        billingSettings = response.data as BillingSettings ;
        assert(billingSettings.billing, 'Billing Properties should not be null');
        assert(keyHash !== billingSettings.stripe.secretKey, 'Hash of the secret key should be different');
      });

      it(
        'Should check prerequisites when switching Transaction Billing ON',
        async () => {
          let response = await billingTestHelper.userService.billingApi.getBillingSetting();
          assert(response.status === StatusCodes.OK, 'Response status should be 200');
          const billingSettings = response.data as BillingSettings ;
          // Let's attempt to switch ON the billing of transactions
          billingSettings.billing.isTransactionBillingActivated = true;
          response = await billingTestHelper.userService.billingApi.updateBillingSetting(billingSettings);
          // taxID is not set - so the prerequisites are not met
          assert(response.status !== StatusCodes.OK, 'Response status should not be 200');
          // Check again the billing connection to STRIPE
          response = await billingTestHelper.userService.billingApi.checkBillingConnection();
          assert(response.status === StatusCodes.OK, 'Response status should be 200');
          assert(response.data, 'Response data should not be null');
          assert(response.data.connectionIsValid === true, 'Connection should be valid');
        }
      );
    });

    describe('As an admin - with transaction billing ON', () => {
      // eslint-disable-next-line @typescript-eslint/require-await
      beforeAll(async () => {
        billingTestHelper.initUserContextAsAdmin();
        // Initialize the Billing module with transaction billing ON
        billingTestHelper.billingImpl = await billingTestHelper.setBillingSystemValidCredentials();
      });

      it('Should be able to invoke Billing Settings endpoints', async () => {
        // Get the Billing settings
        let response = await billingTestHelper.userService.billingApi.getBillingSetting();
        assert(response.status === StatusCodes.OK, 'Response status should be 200');
        const billingSettings = response.data as BillingSettings ;
        assert(billingSettings.billing, 'Billing Properties should not be null');
        assert(billingSettings.type === BillingSettingsType.STRIPE, 'Billing Setting Type should not be set to STRIPE');
        assert(billingSettings.stripe, 'Stripe Properties should not be null');
        assert(billingSettings.stripe.secretKey, 'Secret Key should not be null');
        assert(billingSettings.id, 'ID should not be null');
        // Check billing connection to STRIPE
        response = await billingTestHelper.userService.billingApi.checkBillingConnection();
        assert(response.status === StatusCodes.OK, 'Response status should be 200');
        assert(response.data, 'Response data should not be null');
        assert(response.data.connectionIsValid === true, 'Connection should be valid');
      });

      it(
        'Should not be able to alter the secretKey when transaction billing is ON',
        async () => {
          // Get the Billing settings
          let response = await billingTestHelper.userService.billingApi.getBillingSetting();
          assert(response.status === StatusCodes.OK, 'Response status should be 200');
          let billingSettings = response.data as BillingSettings ;
          assert(billingSettings.billing, 'Billing Properties should not be null');
          assert(billingSettings.billing.isTransactionBillingActivated, 'Transaction Billing should be ON');
          assert(billingSettings.stripe.secretKey, 'Hash of the secret key should not be null');
          const keyHash = billingSettings.stripe.secretKey;
          // Let's attempt to alter the secret key while transaction billing is ON
          billingSettings.stripe.secretKey = '1234567890';
          response = await billingTestHelper.userService.billingApi.updateBillingSetting(billingSettings);
          // Here it does not fail - but the initial secret key should have been preserved!
          assert(response.status === StatusCodes.OK, 'Response status should be 200');
          // Check that the secret key was preserved
          response = await billingTestHelper.userService.billingApi.getBillingSetting();
          assert(response.status === StatusCodes.OK, 'Response status should be 200');
          billingSettings = response.data as BillingSettings ;
          assert(billingSettings.billing, 'Billing Properties should not be null');
          assert(keyHash === billingSettings.stripe.secretKey, 'Hash of the secret key should not have changed');
          // Check again the billing connection to STRIPE
          response = await billingTestHelper.userService.billingApi.checkBillingConnection();
          assert(response.status === StatusCodes.OK, 'Response status should be 200');
          assert(response.data, 'Response data should not be null');
          assert(response.data.connectionIsValid === true, 'Connection should be valid');
        }
      );

      it('Should not be able to switch the transaction billing OFF', async () => {
        // Get the Billing settings
        let response = await billingTestHelper.userService.billingApi.getBillingSetting();
        assert(response.status === StatusCodes.OK, 'Response status should be 200');
        const billingSettings = response.data as BillingSettings ;
        assert(billingSettings.billing, 'Billing Properties should not be null');
        assert(billingSettings.billing.isTransactionBillingActivated, 'Transaction Billing should be ON');
        // Let's attempt to switch the transaction billing OFF
        billingSettings.billing.isTransactionBillingActivated = false;
        response = await billingTestHelper.userService.billingApi.updateBillingSetting(billingSettings);
        assert(response.status === StatusCodes.METHOD_NOT_ALLOWED, 'Response status should be 405');
        // Check again the billing connection to STRIPE
        response = await billingTestHelper.userService.billingApi.checkBillingConnection();
        assert(response.status === StatusCodes.OK, 'Response status should be 200');
        assert(response.data, 'Response data should not be null');
        assert(response.data.connectionIsValid === true, 'Connection should be valid');
      });
    });
  });

  describe('Billing Service (utbilling)', () => {
    beforeAll(async () => {
      await billingTestHelper.initialize(ContextDefinition.TENANT_CONTEXTS.TENANT_BILLING);
    });

    describe('with Transaction Billing ON', () => {
      beforeAll(async () => {
        // Initialize the charing station context
        await billingTestHelper.initChargingStationContext();
        // Initialize the Billing module
        billingTestHelper.billingImpl = await billingTestHelper.setBillingSystemValidCredentials();
        // Make sure the required users are in sync
        const adminUser: User = billingTestHelper.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN);
        const basicUser: User = billingTestHelper.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.BASIC_USER);
        // Synchronize at least these 2 users - this creates a customer on the STRIPE side
        await billingTestHelper.billingImpl.forceSynchronizeUser(adminUser);
        await billingTestHelper.billingImpl.forceSynchronizeUser(basicUser);
      });

      xdescribe('Tune user profiles', () => {
        // eslint-disable-next-line @typescript-eslint/require-await
        beforeAll(async () => {
          billingTestHelper.initUserContextAsAdmin();
        });

        it('Should change admin user locale to fr_FR', async () => {
          const user: User = billingTestHelper.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN);
          const { id, email, name, firstName } = user;
          await billingTestHelper.userService.updateEntity(billingTestHelper.userService.userApi, { id, email, name, firstName, locale: 'fr_FR' }, true);
        });

        it('Should change basic user locale to es_ES', async () => {
          const user: User = billingTestHelper.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.BASIC_USER);
          const { id, email, name, firstName } = user;
          await billingTestHelper.userService.updateEntity(billingTestHelper.userService.userApi, { id, email, name, firstName, locale: 'es_ES' }, true);
        });
      });

      describe('Where admin user (essential)', () => {
        // eslint-disable-next-line @typescript-eslint/require-await
        beforeAll(async () => {
          billingTestHelper.initUserContextAsAdmin();
        });

        it('should add an item to a DRAFT invoice after a transaction', async () => {
          await billingTestHelper.userService.billingApi.forceSynchronizeUser({ id: billingTestHelper.userContext.id });
          const userWithBillingData = await billingTestHelper.billingImpl.getUser(billingTestHelper.userContext);
          await billingTestHelper.assignPaymentMethod(userWithBillingData, 'tok_fr');
          const itemsBefore = await billingTestHelper.getNumberOfSessions(billingTestHelper.userContext.id);
          const transactionID = await billingTestHelper.generateTransaction(billingTestHelper.userContext);
          assert(transactionID, 'transactionID should not be null');
          const itemsAfter = await billingTestHelper.getNumberOfSessions(billingTestHelper.userContext.id);
          expect(itemsAfter).to.be.gt(itemsBefore);
        });
      });

      describe('Where admin user', () => {
        // eslint-disable-next-line @typescript-eslint/require-await
        beforeAll(async () => {
          billingTestHelper.initUserContextAsAdmin();
        });

        it('Should connect to Billing Provider', async () => {
          const response = await billingTestHelper.userService.billingApi.testConnection();
          expect(response.data.connectionIsValid).to.be.true;
          expect(response.data).containSubset(Constants.REST_RESPONSE_SUCCESS);
        });

        it('Should create/update/delete a user', async () => {
          const fakeUser = {
            ...Factory.user.build(),
          } as User;
          fakeUser.issuer = true;
          // Let's create a user
          await billingTestHelper.userService.createEntity(
            billingTestHelper.userService.userApi,
            fakeUser
          );
          billingTestHelper.createdUsers.push(fakeUser);
          // Let's check that the corresponding billing user exists as well (a Customer in the STRIPE DB)
          let billingUser = await billingTestHelper.billingImpl.getUser(fakeUser);
          expect(billingUser).to.be.not.null;
          // Let's update the new user
          fakeUser.firstName = 'Test';
          fakeUser.name = 'NAME';
          fakeUser.issuer = true;
          await billingTestHelper.userService.updateEntity(
            billingTestHelper.userService.userApi,
            fakeUser,
            false
          );
          // Let's check that the corresponding billing user was updated as well
          billingUser = await billingTestHelper.billingImpl.getUser(fakeUser);
          expect(billingUser.name).to.be.eq(fakeUser.firstName + ' ' + fakeUser.name);
          // Let's delete the user
          await billingTestHelper.userService.deleteEntity(
            billingTestHelper.userService.userApi,
            { id: billingTestHelper.createdUsers[0].id }
          );
          // Verify that the corresponding billing user is gone
          const exists = await billingTestHelper.billingImpl.isUserSynchronized(billingTestHelper.createdUsers[0]);
          expect(exists).to.be.false;
          billingTestHelper.createdUsers.shift();
        });

        it(
          'should add an item to the existing invoice after a transaction',
          async () => {
            await billingTestHelper.userService.billingApi.forceSynchronizeUser({ id: billingTestHelper.userContext.id });
            const itemsBefore = await billingTestHelper.getNumberOfSessions(billingTestHelper.userContext.id);
            const transactionID = await billingTestHelper.generateTransaction(billingTestHelper.userContext);
            expect(transactionID).to.not.be.null;
            const itemsAfter = await billingTestHelper.getNumberOfSessions(billingTestHelper.userContext.id);
            expect(itemsAfter).to.be.eq(itemsBefore + 1);
          }
        );

        it('Should list invoices', async () => {
          const response = await billingTestHelper.userService.billingApi.readInvoices({}, TestConstants.DEFAULT_PAGING, TestConstants.DEFAULT_ORDERING);
          expect(response.status).to.be.eq(StatusCodes.OK);
          expect(response.data.result.length).to.be.gt(0);
        });
      });

      describe('Where basic user', () => {

        beforeAll(async () => {
          billingTestHelper.billingImpl = await billingTestHelper.setBillingSystemValidCredentials();
          billingTestHelper.userContext = billingTestHelper.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.BASIC_USER);
          billingTestHelper.userService = new CentralServerService(
            billingTestHelper.tenantContext.getTenant().subdomain,
            billingTestHelper.userContext
          );
          expect(billingTestHelper.userService).to.not.be.null;
        });

        it('Should not be able to test connection to Billing Provider', async () => {
          const response = await billingTestHelper.userService.billingApi.testConnection();
          expect(response.status).to.be.eq(StatusCodes.FORBIDDEN);
        });

        it('Should not synchronize a user', async () => {
          const fakeUser = {
            ...Factory.user.build(),
          } as User;
          const billingUser = await billingTestHelper.billingImpl.synchronizeUser(fakeUser);
          expect(billingUser).to.be.not.null;
        });

        it('Should not force synchronization of a user', async () => {
          const fakeUser = {
            ...Factory.user.build(),
          } as User;
          const response = await billingTestHelper.userService.billingApi.forceSynchronizeUser({ id: fakeUser.id });
          expect(response.status).to.be.eq(StatusCodes.FORBIDDEN);
        });

        it('Should create an invoice after a transaction', async () => {
          const adminUser = billingTestHelper.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN);
          const basicUser = billingTestHelper.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.BASIC_USER);
          // Connect as Admin to Force synchronize basic user
          billingTestHelper.userContext = adminUser;
          billingTestHelper.userService = new CentralServerService(
            billingTestHelper.tenantContext.getTenant().subdomain,
            billingTestHelper.userContext
          );
          await billingTestHelper.userService.billingApi.forceSynchronizeUser({ id: basicUser.id });
          // Reconnect as Basic user
          billingTestHelper.userContext = basicUser;
          billingTestHelper.userService = new CentralServerService(
            billingTestHelper.tenantContext.getTenant().subdomain,
            billingTestHelper.userContext
          );
          const userWithBillingData = await billingTestHelper.billingImpl.getUser(billingTestHelper.userContext);
          await billingTestHelper.assignPaymentMethod(userWithBillingData, 'tok_fr');
          const itemsBefore = await billingTestHelper.getNumberOfSessions(basicUser.id);
          const transactionID = await billingTestHelper.generateTransaction(billingTestHelper.userContext);
          assert(transactionID, 'transactionID should not be null');
          const itemsAfter = await billingTestHelper.getNumberOfSessions(basicUser.id);
          expect(itemsAfter).to.be.eq(itemsBefore + 1);
        });
      });

      describe('Negative tests as an admin user', () => {
        // eslint-disable-next-line @typescript-eslint/require-await
        beforeAll(async () => {
          billingTestHelper.initUserContextAsAdmin();
        });

        it('should not delete a transaction linked to an invoice', async () => {
          const transactionID = await billingTestHelper.generateTransaction(billingTestHelper.userContext);
          expect(transactionID).to.not.be.null;
          const transactionDeleted = await billingTestHelper.userService.transactionApi.delete(transactionID);
          expect(transactionDeleted.data.inError).to.be.eq(1);
          expect(transactionDeleted.data.inSuccess).to.be.eq(0);
        });
      });

      describe('Recovery Scenarios', () => {
        // eslint-disable-next-line @typescript-eslint/require-await
        beforeAll(async () => {
          billingTestHelper.initUserContextAsAdmin();
        });

        afterAll(async () => {
        // Restore VALID STRIPE credentials
          billingTestHelper.billingImpl = await billingTestHelper.setBillingSystemValidCredentials();
        });

        it('Should recover after a synchronization issue', async () => {
          const fakeUser = {
            ...Factory.user.build(),
          } as User;
          fakeUser.issuer = true;
          billingTestHelper.billingImpl = await billingTestHelper.setBillingSystemInvalidCredentials();
          assert(billingTestHelper.billingImpl, 'Billing implementation should not be null');
          await billingTestHelper.userService.createEntity(
            billingTestHelper.userService.userApi,
            fakeUser
          );
          billingTestHelper.createdUsers.push(fakeUser);
          billingTestHelper.billingImpl = await billingTestHelper.setBillingSystemValidCredentials();
          const billingUser = await billingTestHelper.billingImpl.synchronizeUser(fakeUser);
          expect(billingUser).to.be.not.null;
          const userExists = await billingTestHelper.billingImpl.isUserSynchronized(fakeUser);
          expect(userExists).to.be.true;
        });
      });

      describe('Negative tests - Wrong Billing Settings', () => {
        // eslint-disable-next-line @typescript-eslint/require-await
        beforeAll(async () => {
          billingTestHelper.initUserContextAsAdmin();
          // Force INVALID STRIPE credentials
          billingTestHelper.billingImpl = await billingTestHelper.setBillingSystemInvalidCredentials();
          assert(billingTestHelper.billingImpl, 'Billing implementation should not be null');
        });

        afterAll(async () => {
        // Restore VALID STRIPE credentials
          billingTestHelper.billingImpl = await billingTestHelper.setBillingSystemValidCredentials();
        });

        it('Should not be able to start a transaction', async () => {
          const transactionID = await billingTestHelper.generateTransaction(billingTestHelper.userContext, 'Invalid');
          assert(!transactionID, 'Transaction ID should not be set');
        });

      });

      describe('Negative tests', () => {
        // eslint-disable-next-line @typescript-eslint/require-await
        beforeAll(async () => {
          billingTestHelper.initUserContextAsAdmin();
          // Set STRIPE credentials
          billingTestHelper.billingImpl = await billingTestHelper.setBillingSystemInvalidCredentials();
        });

        afterAll(async () => {
        });

        xit('Should set a transaction in error', async () => {
          const transactionID = await billingTestHelper.generateTransaction(billingTestHelper.userContext);
          const transactions = await billingTestHelper.userService.transactionApi.readAllInError({});
          expect(transactions.data.result.find((transaction) => transaction.id === transactionID)).to.not.be.null;
        });

      });

    });

    describe('with Transaction Billing OFF', () => {
      beforeAll(async () => {
        expect(billingTestHelper.userContext).to.not.be.null;
        await billingTestHelper.initChargingStationContext();
        // Initialize the Billing module
        billingTestHelper.billingImpl = await billingTestHelper.setBillingSystemValidCredentials(false);
      });

      describe('Where admin user', () => {
        // eslint-disable-next-line @typescript-eslint/require-await
        beforeAll(async () => {
          billingTestHelper.initUserContextAsAdmin();
        });

        it(
          'should NOT add an item to a DRAFT invoice after a transaction',
          async () => {
            await billingTestHelper.userService.billingApi.forceSynchronizeUser({ id: billingTestHelper.userContext.id });
            // const userWithBillingData = await testData.billingImpl.getUser(testData.userContext);
            // await testData.assignPaymentMethod(userWithBillingData, 'tok_fr');
            const itemsBefore = await billingTestHelper.getNumberOfSessions(billingTestHelper.userContext.id);
            const transactionID = await billingTestHelper.generateTransaction(billingTestHelper.userContext);
            assert(transactionID, 'transactionID should not be null');
            // await testData.userService.billingApi.synchronizeInvoices({});
            const itemsAfter = await billingTestHelper.getNumberOfSessions(billingTestHelper.userContext.id);
            expect(itemsAfter).to.be.eq(itemsBefore);
          }
        );

      });
    });


    describe('with Pricing + Billing', () => {
      beforeAll(async () => {
        billingTestHelper.initUserContextAsAdmin();
        // Initialize the Billing module
        billingTestHelper.billingImpl = await billingTestHelper.setBillingSystemValidCredentials(true, true /* immediateBillingAllowed ON */);
      });

      describe('FF + CT', () => {
        // eslint-disable-next-line @typescript-eslint/require-await
        beforeAll(async () => {
          // Initialize the charing station context
          await billingTestHelper.initChargingStationContext2TestChargingTime();
        });

        it('should create and bill an invoice with FF + CT', async () => {
          await billingTestHelper.userService.billingApi.forceSynchronizeUser({ id: billingTestHelper.userContext.id });
          const userWithBillingData = await billingTestHelper.billingImpl.getUser(billingTestHelper.userContext);
          await billingTestHelper.assignPaymentMethod(userWithBillingData, 'tok_fr');
          const transactionID = await billingTestHelper.generateTransaction(billingTestHelper.userContext);
          assert(transactionID, 'transactionID should not be null');
          // Check that we have a new invoice with an invoiceID and an invoiceNumber
          await billingTestHelper.checkTransactionBillingData(transactionID, BillingInvoiceStatus.PAID, 1.29);
        });

      });

      describe('FF + ENERGY', () => {
        // eslint-disable-next-line @typescript-eslint/require-await
        beforeAll(async () => {
        });

        it('should create and bill an invoice with FF + ENERGY', async () => {
          await billingTestHelper.initChargingStationContext2TestCS3Phased();
          await billingTestHelper.userService.billingApi.forceSynchronizeUser({ id: billingTestHelper.userContext.id });
          const userWithBillingData = await billingTestHelper.billingImpl.getUser(billingTestHelper.userContext);
          await billingTestHelper.assignPaymentMethod(userWithBillingData, 'tok_fr');
          const transactionID = await billingTestHelper.generateTransaction(billingTestHelper.userContext);
          assert(transactionID, 'transactionID should not be null');
          // Check that we have a new invoice with an invoiceID and an invoiceNumber
          await billingTestHelper.checkTransactionBillingData(transactionID, BillingInvoiceStatus.PAID, 10.08);
        });

        it('should create and bill an invoice with FF+ENERGY(STEP)', async () => {
          await billingTestHelper.initChargingStationContext2TestCS3Phased('FF+E(STEP)');
          await billingTestHelper.userService.billingApi.forceSynchronizeUser({ id: billingTestHelper.userContext.id });
          const userWithBillingData = await billingTestHelper.billingImpl.getUser(billingTestHelper.userContext);
          await billingTestHelper.assignPaymentMethod(userWithBillingData, 'tok_fr');
          const transactionID = await billingTestHelper.generateTransaction(billingTestHelper.userContext);
          assert(transactionID, 'transactionID should not be null');
          // Check that we have a new invoice with an invoiceID and an invoiceNumber
          await billingTestHelper.checkTransactionBillingData(transactionID, BillingInvoiceStatus.PAID, 9.50);
        });
      });

      describe('On COMBO CCS - DC', () => {
      // eslint-disable-next-line @typescript-eslint/require-await
        beforeAll(async () => {
        });

        it('should bill the Energy on COMBO CCS - DC', async () => {
          await billingTestHelper.initChargingStationContext2TestFastCharger();
          await billingTestHelper.userService.billingApi.forceSynchronizeUser({ id: billingTestHelper.userContext.id });
          const userWithBillingData = await billingTestHelper.billingImpl.getUser(billingTestHelper.userContext);
          await billingTestHelper.assignPaymentMethod(userWithBillingData, 'tok_fr');
          const transactionID = await billingTestHelper.generateTransaction(billingTestHelper.userContext);
          assert(transactionID, 'transactionID should not be null');
          // Check that we have a new invoice with an invoiceID and an invoiceNumber
          await billingTestHelper.checkTransactionBillingData(transactionID, BillingInvoiceStatus.PAID, 16.16);
        });

        it('should bill the FF+CT+PT on COMBO CCS - DC', async () => {
          await billingTestHelper.initChargingStationContext2TestFastCharger('FF+CT+PT');
          await billingTestHelper.userService.billingApi.forceSynchronizeUser({ id: billingTestHelper.userContext.id });
          const userWithBillingData = await billingTestHelper.billingImpl.getUser(billingTestHelper.userContext);
          await billingTestHelper.assignPaymentMethod(userWithBillingData, 'tok_fr');
          const transactionID = await billingTestHelper.generateTransaction(billingTestHelper.userContext);
          assert(transactionID, 'transactionID should not be null');
          // Check that we have a new invoice with an invoiceID and an invoiceNumber
          await billingTestHelper.checkTransactionBillingData(transactionID, BillingInvoiceStatus.PAID, 11.49);
        });

        it('should bill the CT(STEP)+PT(STEP) on COMBO CCS - DC', async () => {
          await billingTestHelper.initChargingStationContext2TestFastCharger('CT(STEP)+PT(STEP)');
          await billingTestHelper.userService.billingApi.forceSynchronizeUser({ id: billingTestHelper.userContext.id });
          const userWithBillingData = await billingTestHelper.billingImpl.getUser(billingTestHelper.userContext);
          await billingTestHelper.assignPaymentMethod(userWithBillingData, 'tok_fr');
          const transactionID = await billingTestHelper.generateTransaction(billingTestHelper.userContext);
          assert(transactionID, 'transactionID should not be null');
          // Check that we have a new invoice with an invoiceID and an invoiceNumber
          await billingTestHelper.checkTransactionBillingData(transactionID, BillingInvoiceStatus.PAID, 21.00);
        });

        it('should bill the ENERGY + PT(STEP) on COMBO CCS - DC', async () => {
          await billingTestHelper.initChargingStationContext2TestFastCharger('E+PT(STEP)');
          await billingTestHelper.userService.billingApi.forceSynchronizeUser({ id: billingTestHelper.userContext.id });
          const userWithBillingData = await billingTestHelper.billingImpl.getUser(billingTestHelper.userContext);
          await billingTestHelper.assignPaymentMethod(userWithBillingData, 'tok_fr');
          const transactionID = await billingTestHelper.generateTransaction(billingTestHelper.userContext);
          assert(transactionID, 'transactionID should not be null');
          // Check that we have a new invoice with an invoiceID and an invoiceNumber
          await billingTestHelper.checkTransactionBillingData(transactionID, BillingInvoiceStatus.PAID, 29.49);
        });

        it('should bill the ENERGY + CT(STEP80S) on COMBO CCS - DC', async () => {
          await billingTestHelper.initChargingStationContext2TestFastCharger('E+CT(STEP80S)');
          await billingTestHelper.userService.billingApi.forceSynchronizeUser({ id: billingTestHelper.userContext.id });
          const userWithBillingData = await billingTestHelper.billingImpl.getUser(billingTestHelper.userContext);
          await billingTestHelper.assignPaymentMethod(userWithBillingData, 'tok_fr');
          const transactionID = await billingTestHelper.generateTransaction(billingTestHelper.userContext);
          assert(transactionID, 'transactionID should not be null');
          // Check that we have a new invoice with an invoiceID and an invoiceNumber
          await billingTestHelper.checkTransactionBillingData(transactionID, BillingInvoiceStatus.PAID, 10.11);
        });

        it('should bill the FF+E with 2 tariffs on COMBO CCS - DC', async () => {
          // A first Tariff for the ENERGY Only
          await billingTestHelper.initChargingStationContext2TestFastCharger('FF+E');
          // A second Tariff applied after 30 mins!
          await billingTestHelper.initChargingStationContext2TestFastCharger('E-After30mins+PT');
          // A tariff applied immediately
          await billingTestHelper.userService.billingApi.forceSynchronizeUser({ id: billingTestHelper.userContext.id });
          const userWithBillingData = await billingTestHelper.billingImpl.getUser(billingTestHelper.userContext);
          await billingTestHelper.assignPaymentMethod(userWithBillingData, 'tok_fr');
          const transactionID = await billingTestHelper.generateTransaction(billingTestHelper.userContext);
          assert(transactionID, 'transactionID should not be null');
          // Check that we have a new invoice with an invoiceID and an invoiceNumber
          await billingTestHelper.checkTransactionBillingData(transactionID, BillingInvoiceStatus.PAID, 34.63);
        });

        it(
          'should bill the FF+E(STEP)+E(STEP) with 2 tariffs on COMBO CCS - DC',
          async () => {
            // A first Tariff for the ENERGY Only
            await billingTestHelper.initChargingStationContext2TestFastCharger('FF+E(STEP)-MainTariff');
            // A second Tariff applied after 30 mins!
            await billingTestHelper.initChargingStationContext2TestFastCharger('E(STEP)-After30mins');
            // A tariff applied immediately
            await billingTestHelper.userService.billingApi.forceSynchronizeUser({ id: billingTestHelper.userContext.id });
            const userWithBillingData = await billingTestHelper.billingImpl.getUser(billingTestHelper.userContext);
            await billingTestHelper.assignPaymentMethod(userWithBillingData, 'tok_fr');
            const transactionID = await billingTestHelper.generateTransaction(billingTestHelper.userContext);
            assert(transactionID, 'transactionID should not be null');
            // Check that we have a new invoice with an invoiceID and an invoiceNumber
            await billingTestHelper.checkTransactionBillingData(transactionID, BillingInvoiceStatus.PAID, 25);
          }
        );

        it(
          'should bill the FF+E+E(STEP) with 2 tariffs on COMBO CCS - DC',
          async () => {
            // A first Tariff for the ENERGY Only
            await billingTestHelper.initChargingStationContext2TestFastCharger('FF+E');
            // A second Tariff applied after 30 mins!
            await billingTestHelper.initChargingStationContext2TestFastCharger('E(STEP)-After30mins');
            // A tariff applied immediately
            await billingTestHelper.userService.billingApi.forceSynchronizeUser({ id: billingTestHelper.userContext.id });
            const userWithBillingData = await billingTestHelper.billingImpl.getUser(billingTestHelper.userContext);
            await billingTestHelper.assignPaymentMethod(userWithBillingData, 'tok_fr');
            const transactionID = await billingTestHelper.generateTransaction(billingTestHelper.userContext);
            assert(transactionID, 'transactionID should not be null');
            // Check that we have a new invoice with an invoiceID and an invoiceNumber
            await billingTestHelper.checkTransactionBillingData(transactionID, BillingInvoiceStatus.PAID, 17.37);
          }
        );
      });

      describe('Check Dynamic Restrictions on COMBO CCS - DC', () => {
        // eslint-disable-next-line @typescript-eslint/require-await
        beforeAll(async () => {
        });

        it(
          'should bill an invoice taking the Day of the week into account',
          async () => {
            await billingTestHelper.initChargingStationContext2TestDaysOfTheWeek('TODAY');
            await billingTestHelper.initChargingStationContext2TestDaysOfTheWeek('OTHER_DAYS');
            // Check the charging station timezone
            billingTestHelper.checkTimezone();
            // A tariff applied immediately
            await billingTestHelper.userService.billingApi.forceSynchronizeUser({ id: billingTestHelper.userContext.id });
            const userWithBillingData = await billingTestHelper.billingImpl.getUser(billingTestHelper.userContext);
            await billingTestHelper.assignPaymentMethod(userWithBillingData, 'tok_fr');
            const transactionID = await billingTestHelper.generateTransaction(billingTestHelper.userContext);
            assert(transactionID, 'transactionID should not be null');
            // Check that we have a new invoice with an invoiceID and an invoiceNumber
            await billingTestHelper.checkTransactionBillingData(transactionID, BillingInvoiceStatus.PAID, 33.82);
          }
        );

        it('should bill an invoice taking the Time Range into account', async () => {
          const atThatParticularMoment = moment();
          await billingTestHelper.initChargingStationContext2TestTimeRestrictions('OTHER_HOURS', atThatParticularMoment);
          await billingTestHelper.initChargingStationContext2TestTimeRestrictions('NEXT_HOUR', atThatParticularMoment);
          await billingTestHelper.initChargingStationContext2TestTimeRestrictions('FOR_HALF_AN_HOUR', atThatParticularMoment);
          // Check the charging station timezone
          billingTestHelper.checkTimezone();
          // A tariff applied immediately
          await billingTestHelper.userService.billingApi.forceSynchronizeUser({ id: billingTestHelper.userContext.id });
          const userWithBillingData = await billingTestHelper.billingImpl.getUser(billingTestHelper.userContext);
          await billingTestHelper.assignPaymentMethod(userWithBillingData, 'tok_fr');
          const transactionID = await billingTestHelper.generateTransaction(billingTestHelper.userContext);
          assert(transactionID, 'transactionID should not be null');
          // Check that we have a new invoice with an invoiceID and an invoiceNumber
          await billingTestHelper.checkTransactionBillingData(transactionID, BillingInvoiceStatus.PAID, 59.99);
        });

        it(
          'should bill an invoice taking a reverted Time Range into account',
          async () => {
            const atThatParticularMoment = moment();
            await billingTestHelper.initChargingStationContext2TestTimeRestrictions('OTHER_HOURS', atThatParticularMoment);
            await billingTestHelper.initChargingStationContext2TestTimeRestrictions('FROM_23:59', atThatParticularMoment);
            // Check the charging station timezone
            billingTestHelper.checkTimezone();
            // A tariff applied immediately
            await billingTestHelper.userService.billingApi.forceSynchronizeUser({ id: billingTestHelper.userContext.id });
            const userWithBillingData = await billingTestHelper.billingImpl.getUser(billingTestHelper.userContext);
            await billingTestHelper.assignPaymentMethod(userWithBillingData, 'tok_fr');
            const transactionID = await billingTestHelper.generateTransaction(billingTestHelper.userContext);
            assert(transactionID, 'transactionID should not be null');
            // Check that we have a new invoice with an invoiceID and an invoiceNumber
            await billingTestHelper.checkTransactionBillingData(transactionID, BillingInvoiceStatus.PAID, 16.16);
          }
        );

      });

      describe('When basic user has a free access', () => {
        // eslint-disable-next-line @typescript-eslint/require-await
        beforeAll(async () => {
          // Initialize the charging station context
          await billingTestHelper.initChargingStationContext();
          billingTestHelper.billingImpl = await billingTestHelper.setBillingSystemValidCredentials();
          billingTestHelper.adminUserContext = await billingTestHelper.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN);
          expect(billingTestHelper.adminUserContext).to.not.be.null;
          billingTestHelper.userContext = billingTestHelper.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.BASIC_USER);
          billingTestHelper.userService = new CentralServerService(
            billingTestHelper.tenantContext.getTenant().subdomain,
            billingTestHelper.userContext
          );
          billingTestHelper.adminUserService = new CentralServerService(
            billingTestHelper.tenantContext.getTenant().subdomain,
            billingTestHelper.adminUserContext
          );
          expect(billingTestHelper.userService).to.not.be.null;
          // Update the freeAccess flag for the basic user:
          await billingTestHelper.adminUserService.userApi.update({
            id: ContextDefinition.TENANT_USER_LIST[2].id,
            freeAccess: true
          });
        });

        it(
          'should NOT add an item to a DRAFT invoice after a transaction',
          async () => {
            await billingTestHelper.userService.billingApi.forceSynchronizeUser({ id: billingTestHelper.userContext.id });
            const userWithBillingData = await billingTestHelper.billingImpl.getUser(billingTestHelper.userContext);
            await billingTestHelper.assignPaymentMethod(userWithBillingData, 'tok_fr');
            const itemsBefore = await billingTestHelper.getNumberOfSessions(billingTestHelper.userContext.id);
            const transactionID = await billingTestHelper.generateTransaction(billingTestHelper.userContext);
            assert(transactionID, 'transactionID should not be null');
            // await testData.checkTransactionBillingData(transactionID); // TODO - Check not yet possible!
            // await testData.userService.billingApi.synchronizeInvoices({});
            const itemsAfter = await billingTestHelper.getNumberOfSessions(billingTestHelper.userContext.id);
            expect(itemsAfter).eq(itemsBefore);
          }
        );
      });

      describe('When basic user does not have a free access', () => {
        // eslint-disable-next-line @typescript-eslint/require-await
        beforeAll(async () => {
          // Initialize the charging station context
          await billingTestHelper.initChargingStationContext();
          billingTestHelper.billingImpl = await billingTestHelper.setBillingSystemValidCredentials();
          billingTestHelper.adminUserContext = await billingTestHelper.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.DEFAULT_ADMIN);
          expect(billingTestHelper.adminUserContext).to.not.be.null;
          billingTestHelper.userContext = billingTestHelper.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.BASIC_USER);
          billingTestHelper.userService = new CentralServerService(
            billingTestHelper.tenantContext.getTenant().subdomain,
            billingTestHelper.userContext
          );
          billingTestHelper.adminUserService = new CentralServerService(
            billingTestHelper.tenantContext.getTenant().subdomain,
            billingTestHelper.adminUserContext
          );
          expect(billingTestHelper.userService).to.not.be.null;
          // Update the freeAccess flag for the basic user:
          await billingTestHelper.adminUserService.userApi.update({
            id: ContextDefinition.TENANT_USER_LIST[2].id,
            freeAccess: false
          });
        });

        it('should add an item to a DRAFT invoice after a transaction', async () => {
          await billingTestHelper.userService.billingApi.forceSynchronizeUser({ id: billingTestHelper.userContext.id });
          // const userWithBillingData = await testData.billingImpl.getUser(testData.userContext);
          // await testData.assignPaymentMethod(userWithBillingData, 'tok_fr');
          const itemsBefore = await billingTestHelper.getNumberOfSessions(billingTestHelper.userContext.id);
          const transactionID = await billingTestHelper.generateTransaction(billingTestHelper.userContext);
          assert(transactionID, 'transactionID should not be null');
          // await testData.checkTransactionBillingData(transactionID); // TODO - Check not yet possible!
          // await testData.userService.billingApi.synchronizeInvoices({});
          const itemsAfter = await billingTestHelper.getNumberOfSessions(billingTestHelper.userContext.id);
          expect(itemsAfter).to.be.gt(itemsBefore);
        });
      });

    });

    describe('with Transaction Billing + Periodic Billing ON', () => {
      beforeAll(async () => {
        billingTestHelper.initUserContextAsAdmin();
        // Initialize the Billing module
        billingTestHelper.billingImpl = await billingTestHelper.setBillingSystemValidCredentials(true, false /* immediateBillingAllowed OFF, so periodicBilling ON */);
      });

      describe('Where admin user', () => {
      // eslint-disable-next-line @typescript-eslint/require-await
        beforeAll(async () => {
          // Initialize the charing station context
          await billingTestHelper.initChargingStationContext2TestChargingTime();
        });

        it('should create a DRAFT invoice, Finalize it and Pay it', async () => {
          await billingTestHelper.userService.billingApi.forceSynchronizeUser({ id: billingTestHelper.userContext.id });
          const userWithBillingData = await billingTestHelper.billingImpl.getUser(billingTestHelper.userContext);
          await billingTestHelper.assignPaymentMethod(userWithBillingData, 'tok_fr');
          const transactionID = await billingTestHelper.generateTransaction(billingTestHelper.userContext);
          assert(transactionID, 'transactionID should not be null');
          // Check that we have a new invoice with an invoiceID and but no invoiceNumber yet
          await billingTestHelper.checkTransactionBillingData(transactionID, BillingInvoiceStatus.DRAFT);
          // Let's simulate the periodic billing operation
          const taskConfiguration: BillingPeriodicOperationTaskConfig = {
            onlyProcessUnpaidInvoices: false,
            forceOperation: true
          };
          const operationResult: BillingChargeInvoiceAction = await billingTestHelper.billingImpl.chargeInvoices(taskConfiguration);
          assert(operationResult.inSuccess > 0, 'The operation should have been able to process at least one invoice');
          assert(operationResult.inError === 0, 'The operation should detect any errors');
          // The transaction should now have a different status and know the final invoice number
          await billingTestHelper.checkTransactionBillingData(transactionID, BillingInvoiceStatus.PAID);
          // The user should have no DRAFT invoices
          const nbDraftInvoices = await billingTestHelper.checkForDraftInvoices();
          assert(nbDraftInvoices === 0, 'The expected number of DRAFT invoices is not correct');
        });

      });
    });

    describe('Pricing Definition', () => {
      beforeAll(async () => {
      });

      afterAll(async () => {
      });

      it('check CRUD operations on a Pricing Model', async () => {
        await billingTestHelper.checkPricingDefinitionEndpoints();
      });
    });

    describe('Transaction Inconsistency Recovery', () => {
      beforeAll(async () => {
        billingTestHelper.initUserContextAsAdmin();
        // Initialize the Billing module
        billingTestHelper.billingImpl = await billingTestHelper.setBillingSystemValidCredentials(true, true /* immediateBillingAllowed ON */);
        await billingTestHelper.initChargingStationContext2TestChargingTime();
      });

      afterAll(async () => {
      });

      it('check Soft Stop Transaction', async () => {
        const dateInThePast = moment().add(-5, 'hours').toDate();
        await billingTestHelper.initChargingStationContext2TestFastCharger('E+PT(STEP)', dateInThePast);
        await billingTestHelper.userService.billingApi.forceSynchronizeUser({ id: billingTestHelper.userContext.id });
        const userWithBillingData = await billingTestHelper.billingImpl.getUser(billingTestHelper.userContext);
        await billingTestHelper.assignPaymentMethod(userWithBillingData, 'tok_fr');
        const transactionID = await billingTestHelper.generateTransaction(billingTestHelper.userContext, 'Accepted', dateInThePast, true);
        assert(transactionID, 'transactionID should not be null');
        // Check that we have a new invoice with an invoiceID and an invoiceNumber
        await billingTestHelper.checkTransactionBillingData(transactionID, BillingInvoiceStatus.PAID, 19.49);
      });
    });
  });

  describe('Billing Service (utbillingplatform)', () => {
    beforeAll(async () => {
      await billingTestHelper.initialize(ContextDefinition.TENANT_CONTEXTS.TENANT_BILLING_PLATFORM);
      // Initialize the Billing module
      billingTestHelper.billingImpl = await billingTestHelper.setBillingSystemValidCredentials();
    });

    describe('Where admin user', () => {
      // eslint-disable-next-line @typescript-eslint/require-await
      beforeAll(async () => {
        billingTestHelper.initUserContextAsAdmin();
      });

      describe('Sub accounts', () => {
        it('should create a sub account', async () => {
          const response = await billingTestHelper.userService.billingApi.createSubAccount({
            businessOwnerID: billingTestHelper.userContext.id
          });
          const subAccount = response.data as BillingAccount;
          expect(response.status).to.be.eq(StatusCodes.CREATED);
          expect(subAccount.id).to.not.be.null;
          expect(subAccount.accountExternalID).to.not.be.null;
          expect(subAccount.businessOwnerID).to.eq(billingTestHelper.userContext.id);
          expect(subAccount.activationLink).to.not.be.null;
          expect(subAccount.status).to.be.eq(BillingAccountStatus.IDLE);
        });

        it('should create a sub account and activate it', async () => {
          // Create a sub account
          const response = await billingTestHelper.userService.billingApi.createSubAccount({
            businessOwnerID: billingTestHelper.userContext.id
          });
          expect(response.status).to.be.eq(StatusCodes.CREATED);
          // Send the activation link
          const subAccountOnboardResponse = await billingTestHelper.userService.billingApi.sendSubAccountOnboarding(response.data.id);
          expect(subAccountOnboardResponse.status).to.be.eq(StatusCodes.OK);
          expect(subAccountOnboardResponse.data.status).to.be.eq(BillingAccountStatus.PENDING);
          // Activate the sub account
          const activationResponse = await billingTestHelper.userService.billingApi.activateSubAccount({ accountID: response.data.id, TenantID: billingTestHelper.tenantContext.getTenant().id });
          expect(activationResponse.status).to.be.eq(StatusCodes.OK);
          expect(activationResponse.data.status).to.be.eq(BillingAccountStatus.ACTIVE);
        });

        it('should not activate an inexistent sub account', async () => {
          const activationResponse = await billingTestHelper.userService.billingApi.activateSubAccount({ accountID: '5ce249a1a39ae1c056c389bd', TenantID: billingTestHelper.tenantContext.getTenant().id });
          expect(activationResponse.status).to.be.eq(StatusCodes.NOT_FOUND);
        });

        it('should not activate a sub account twice', async () => {
          // Create a sub account
          const response = await billingTestHelper.userService.billingApi.createSubAccount({
            businessOwnerID: billingTestHelper.userContext.id
          });
          expect(response.status).to.be.eq(StatusCodes.CREATED);
          // Send the activation link
          const subAccountOnboardResponse = await billingTestHelper.userService.billingApi.sendSubAccountOnboarding(response.data.id);
          expect(subAccountOnboardResponse.status).to.be.eq(StatusCodes.OK);
          // Activate the sub account
          let activationResponse = await billingTestHelper.userService.billingApi.activateSubAccount({ accountID: response.data.id, TenantID: billingTestHelper.tenantContext.getTenant().id });
          expect(activationResponse.status).to.be.eq(StatusCodes.OK);
          activationResponse = await billingTestHelper.userService.billingApi.activateSubAccount({ accountID: response.data.id, TenantID: billingTestHelper.tenantContext.getTenant().id });
          expect(activationResponse.status).to.be.eq(StatusCodes.INTERNAL_SERVER_ERROR);
        });

        it('should create a company assigned to a sub-account', async () => {
          const subAccountResponse = await billingTestHelper.userService.billingApi.createSubAccount({
            businessOwnerID: billingTestHelper.userContext.id
          });
          expect(subAccountResponse.status).to.be.eq(StatusCodes.CREATED);

          const platformFeeStrategy = BillingPlatformFeeStrategyFactory.build();
          let companyResponse = await billingTestHelper.userService.companyApi.create({
            ...CompanyFactory.build(),
            accountData: {
              accountID: subAccountResponse.data.id,
              platformFeeStrategy
            }
          });
          expect(companyResponse.status).to.be.eq(StatusCodes.OK);
          companyResponse = await billingTestHelper.userService.companyApi.readById(companyResponse.data.id);
          expect(companyResponse.data.accountData.accountID).to.eq(subAccountResponse.data.id);
          expect(companyResponse.data.accountData.platformFeeStrategy).to.deep.eq(platformFeeStrategy);
        });

        it('should update a company to assign a sub-account', async () => {
          const subAccountResponse = await billingTestHelper.userService.billingApi.createSubAccount({
            businessOwnerID: billingTestHelper.userContext.id
          });
          expect(subAccountResponse.status).to.be.eq(StatusCodes.CREATED);

          let companyResponse = await billingTestHelper.userService.companyApi.create(CompanyFactory.build());
          expect(companyResponse.status).to.be.eq(StatusCodes.OK);
          const companyID = companyResponse.data.id;
          const platformFeeStrategy = BillingPlatformFeeStrategyFactory.build();
          companyResponse = await billingTestHelper.userService.companyApi.update({
            id: companyID,
            ...CompanyFactory.build(),
            accountData: {
              accountID: subAccountResponse.data.id,
              platformFeeStrategy
            }
          });
          expect(companyResponse.status).to.be.eq(StatusCodes.OK);

          companyResponse = await billingTestHelper.userService.companyApi.readById(companyID);
          expect(companyResponse.data.accountData.accountID).to.eq(subAccountResponse.data.id);
          expect(companyResponse.data.accountData.platformFeeStrategy).to.deep.eq(platformFeeStrategy);
        });

        it('should create a site assigned to a sub-account', async () => {
          const subAccountResponse = await billingTestHelper.userService.billingApi.createSubAccount({
            businessOwnerID: billingTestHelper.userContext.id
          });
          expect(subAccountResponse.status).to.be.eq(StatusCodes.CREATED);

          // Create a company
          const companyResponse = await billingTestHelper.userService.companyApi.create(CompanyFactory.build());
          expect(companyResponse.status).to.be.eq(StatusCodes.OK);
          // Create a site
          const platformFeeStrategy = BillingPlatformFeeStrategyFactory.build();
          let siteResponse = await billingTestHelper.userService.siteApi.create({
            ...SiteFactory.build(),
            companyID: companyResponse.data.id,
            accountData: {
              accountID: subAccountResponse.data.id,
              platformFeeStrategy
            }
          });
          expect(siteResponse.status).to.be.eq(StatusCodes.OK);
          siteResponse = await billingTestHelper.userService.siteApi.readById(siteResponse.data.id);
          expect(siteResponse.data.accountData.accountID).to.eq(subAccountResponse.data.id);
          expect(siteResponse.data.accountData.platformFeeStrategy).to.deep.eq(platformFeeStrategy);
        });

        it('should update a site to assign a sub-account', async () => {
          const subAccountResponse = await billingTestHelper.userService.billingApi.createSubAccount({
            businessOwnerID: billingTestHelper.userContext.id
          });
          expect(subAccountResponse.status).to.be.eq(StatusCodes.CREATED);

          // Create a company
          const companyResponse = await billingTestHelper.userService.companyApi.create(CompanyFactory.build());
          expect(companyResponse.status).to.be.eq(StatusCodes.OK);
          // Create a site
          let siteResponse = await billingTestHelper.userService.siteApi.create({
            ...SiteFactory.build(),
            companyID: companyResponse.data.id,
          });
          expect(siteResponse.status).to.be.eq(StatusCodes.OK);
          const siteID = siteResponse.data.id;

          const platformFeeStrategy = BillingPlatformFeeStrategyFactory.build();
          siteResponse = await billingTestHelper.userService.siteApi.update({
            id: siteID,
            ...SiteFactory.build(),
            companyID: companyResponse.data.id,
            accountData: {
              accountID: subAccountResponse.data.id,
              platformFeeStrategy
            }
          });
          expect(siteResponse.status).to.be.eq(StatusCodes.OK);

          siteResponse = await billingTestHelper.userService.siteApi.readById(siteID);
          expect(siteResponse.data.accountData.accountID).to.eq(subAccountResponse.data.id);
          expect(siteResponse.data.accountData.platformFeeStrategy).to.deep.eq(platformFeeStrategy);
        });

        it('should list sub-accounts', async () => {
          const subAccountResponse = await billingTestHelper.userService.billingApi.createSubAccount({
            businessOwnerID: billingTestHelper.userContext.id
          });
          expect(subAccountResponse.status).to.be.eq(StatusCodes.CREATED);

          // List sub-accounts
          const subAccountsResponse = await billingTestHelper.userService.billingApi.readSubAccounts({
            userID: billingTestHelper.userContext.id
          });
          expect(subAccountsResponse.status).to.be.eq(StatusCodes.OK);
          expect(subAccountsResponse.data.result.map((subAccount: BillingAccount) => subAccount.id)).to.include(subAccountResponse.data.id);
        });

        it('should read sub-account', async () => {
          const subAccountCreateResponse = await billingTestHelper.userService.billingApi.createSubAccount({
            businessOwnerID: billingTestHelper.userContext.id
          });
          expect(subAccountCreateResponse.status).to.be.eq(StatusCodes.CREATED);

          // Get the sub-account
          const subAccountResponse = await billingTestHelper.userService.billingApi.readSubAccount(subAccountCreateResponse.data.id);
          const subAccount = subAccountResponse.data as BillingAccount;
          expect(subAccountResponse.status).to.be.eq(StatusCodes.OK);
          expect(subAccount.id).to.be.eq(subAccountCreateResponse.data.id);
          expect(subAccount.businessOwnerID).to.be.eq(billingTestHelper.userContext.id);
          expect(subAccount.status).to.be.eq(BillingAccountStatus.IDLE);
        });

        it('should send sub-account onboarding', async () => {
          const subAccountCreateResponse = await billingTestHelper.userService.billingApi.createSubAccount({
            businessOwnerID: billingTestHelper.userContext.id
          });
          expect(subAccountCreateResponse.status).to.be.eq(StatusCodes.CREATED);

          const subAccountOnboardResponse = await billingTestHelper.userService.billingApi.sendSubAccountOnboarding(subAccountCreateResponse.data.id);
          expect(subAccountOnboardResponse.status).to.be.eq(StatusCodes.OK);
          expect(subAccountOnboardResponse.data.status).to.be.eq(BillingAccountStatus.PENDING);
        });

        it('should not able to send sub-account onboarding twice', async () => {
          const subAccountCreateResponse = await billingTestHelper.userService.billingApi.createSubAccount({
            businessOwnerID: billingTestHelper.userContext.id
          });
          expect(subAccountCreateResponse.status).to.be.eq(StatusCodes.CREATED);

          let subAccountOnboardResponse = await billingTestHelper.userService.billingApi.sendSubAccountOnboarding(subAccountCreateResponse.data.id);
          expect(subAccountOnboardResponse.status).to.be.eq(StatusCodes.OK);
          expect(subAccountOnboardResponse.data.status).to.be.eq(BillingAccountStatus.PENDING);

          subAccountOnboardResponse = await billingTestHelper.userService.billingApi.sendSubAccountOnboarding(subAccountCreateResponse.data.id);
          expect(subAccountOnboardResponse.status).to.be.eq(StatusCodes.INTERNAL_SERVER_ERROR);
        });

        it('should not able to send sub-account onboarding for an activated sub-account', async () => {
          // Create the sub account
          const subAccountCreateResponse = await billingTestHelper.userService.billingApi.createSubAccount({
            businessOwnerID: billingTestHelper.userContext.id
          });
          expect(subAccountCreateResponse.status).to.be.eq(StatusCodes.CREATED);
          // Send onboarding
          let subAccountOnboardResponse = await billingTestHelper.userService.billingApi.sendSubAccountOnboarding(subAccountCreateResponse.data.id);
          expect(subAccountOnboardResponse.status).to.be.eq(StatusCodes.OK);
          expect(subAccountOnboardResponse.data.status).to.be.eq(BillingAccountStatus.PENDING);
          // Activate it
          const activationResponse = await billingTestHelper.userService.billingApi.activateSubAccount({ accountID: subAccountCreateResponse.data.id, TenantID: billingTestHelper.tenantContext.getTenant().id });
          expect(activationResponse.status).to.be.eq(StatusCodes.OK);
          expect(activationResponse.data.status).to.be.eq(BillingAccountStatus.ACTIVE);
          // Try to re-send onboarding
          subAccountOnboardResponse = await billingTestHelper.userService.billingApi.sendSubAccountOnboarding(subAccountCreateResponse.data.id);
          expect(subAccountOnboardResponse.status).to.be.eq(StatusCodes.INTERNAL_SERVER_ERROR);
        });
      });

      describe('Transfers', () => {
        it('should list transfers', async () => {
          const transfer = BillingTransferFactory.build();
          const transferID = await BillingStorage.saveTransfer(billingTestHelper.tenantContext.getTenant(), transfer);
          transfer.id = transferID;

          const transfersResponse = await billingTestHelper.userService.billingApi.readTransfers({});
          expect(transfersResponse.status).to.be.eq(StatusCodes.OK);
          expect(transfersResponse.data.result).to.containSubset([transfer]);
        });
      });
    });

    describe('Where basic user', () => {

      beforeAll(async () => {
        billingTestHelper.billingImpl = await billingTestHelper.setBillingSystemValidCredentials();
        billingTestHelper.userContext = billingTestHelper.tenantContext.getUserContext(ContextDefinition.USER_CONTEXTS.BASIC_USER);
        billingTestHelper.userService = new CentralServerService(
          billingTestHelper.tenantContext.getTenant().subdomain,
          billingTestHelper.userContext
        );
        expect(billingTestHelper.userService).to.not.be.null;
      });

      it('should not be able to create a sub account', async () => {
        const response = await billingTestHelper.userService.billingApi.createSubAccount({
          businessOwnerID: billingTestHelper.userContext.id
        });
        expect(response.status).to.be.eq(StatusCodes.FORBIDDEN);
      });

      it('should not activate an inexistent sub account', async () => {
        const activationResponse = await billingTestHelper.userService.billingApi.activateSubAccount({
          accountID: '5ce249a1a39ae1c056c389bd', // inexistent sub account
          TenantID: billingTestHelper.tenantContext.getTenant().id
        });
        expect(activationResponse.status).to.be.eq(StatusCodes.NOT_FOUND);
      });

      it('should not be able to list sub-accounts', async () => {
        const subAccountsResponse = await billingTestHelper.userService.billingApi.readSubAccounts({});
        expect(subAccountsResponse.status).to.be.eq(StatusCodes.FORBIDDEN);
      });

      it('should not be able to read sub-account', async () => {
        // List sub-accounts
        const subAccountResponse = await billingTestHelper.userService.billingApi.readSubAccount('62978713f146ea8cb3bf8a95'); // inexistent sub account
        expect(subAccountResponse.status).to.be.eq(StatusCodes.FORBIDDEN);
      });

      it('should not be able to send sub-account onboarding', async () => {
        // List sub-accounts
        const subAccountResponse = await billingTestHelper.userService.billingApi.sendSubAccountOnboarding('62978713f146ea8cb3bf8a95'); // inexistent sub account
        expect(subAccountResponse.status).to.be.eq(StatusCodes.FORBIDDEN);
      });

      it('should not be able to list transfers', async () => {
        const transfersResponse = await billingTestHelper.userService.billingApi.readTransfers({});
        expect(transfersResponse.status).to.be.eq(StatusCodes.FORBIDDEN);
      });
    });

    describe('Storage', () => {
      it('should save a billing transfer', async () => {
        const transfer = BillingTransferFactory.build();
        const transferID = await BillingStorage.saveTransfer(billingTestHelper.tenantContext.getTenant(), transfer);
        expect(transferID).to.not.be.null;

        const retrievedTransfer = await BillingStorage.getTransferByID(billingTestHelper.tenantContext.getTenant(), transferID);
        expect(retrievedTransfer).to.containSubset(transfer);
      });

      it('should list billing transfers', async () => {
        const transfers = [
          BillingTransferFactory.build(),
          BillingTransferFactory.build(),
        ];
        const ids = await Promise.all(transfers.map(async (transfer) => BillingStorage.saveTransfer(billingTestHelper.tenantContext.getTenant(), transfer)));

        const retrievedTransfers = await BillingStorage.getTransfers(billingTestHelper.tenantContext.getTenant(), {}, Constants.DB_PARAMS_MAX_LIMIT);
        expect(retrievedTransfers.result.map((transfer) => transfer.id)).to.include.members(ids);
      });
    });
  });

  describe('Billing Test Data Cleanup (utbilling)', () => {
    beforeAll(async () => {
      await stripeTestHelper.initialize();
    });

    describe('with a STRIPE live account (a fake one!)', () => {
      beforeAll(async () => {
        await stripeTestHelper.fakeLiveBillingSettings();
      });

      it('should NOT cleanup all billing test data', async () => {
        await stripeTestHelper.checkTestDataCleanup(false);
      });
    });

    describe('with a STRIPE test account', () => {
      beforeAll(async () => {
        await stripeTestHelper.setBillingSystemValidCredentials(true);
      });

      it('should cleanup all billing test data', async () => {
        await stripeTestHelper.checkTestDataCleanup(true);
      });
    });
  });

});
