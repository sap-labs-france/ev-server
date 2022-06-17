/* eslint-disable max-len */
import { BillingAccount, BillingAccountStatus, BillingChargeInvoiceAction, BillingInvoiceStatus } from '../../src/types/Billing';
import chai, { expect } from 'chai';

import { BillingPeriodicOperationTaskConfig } from '../types/TaskConfig';
import BillingStorage from '../../src/storage/mongodb/BillingStorage';
import BillingTestHelper from './BillingTestHelper';
import { BillingTransferFactory } from '../factories/BillingFactory';
import CentralServerService from './client/CentralServerService';
import CompanyFactory from '../factories/CompanyFactory';
import Constants from '../../src/utils/Constants';
import ContextDefinition from './context/ContextDefinition';
import MongoDBStorage from '../../src/storage/mongodb/MongoDBStorage';
import SiteFactory from '../factories/SiteFactory';
import { StatusCodes } from 'http-status-codes';
import StripeTestHelper from './StripeTestHelper';
import assert from 'assert';
import chaiSubset from 'chai-subset';
import config from '../config';
import global from '../../src/types/GlobalType';
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

          let companyResponse = await billingTestHelper.userService.companyApi.create({
            ...CompanyFactory.build(),
            accountData: {
              accountID: subAccountResponse.data.id
            }
          });
          expect(companyResponse.status).to.be.eq(StatusCodes.OK);
          companyResponse = await billingTestHelper.userService.companyApi.readById(companyResponse.data.id);
          expect(companyResponse.data.accountData.accountID).to.eq(subAccountResponse.data.id);
        });

        it('should update a company to assign a sub-account', async () => {
          const subAccountResponse = await billingTestHelper.userService.billingApi.createSubAccount({
            businessOwnerID: billingTestHelper.userContext.id
          });
          expect(subAccountResponse.status).to.be.eq(StatusCodes.CREATED);

          let companyResponse = await billingTestHelper.userService.companyApi.create(CompanyFactory.build());
          expect(companyResponse.status).to.be.eq(StatusCodes.OK);
          const companyID = companyResponse.data.id;
          companyResponse = await billingTestHelper.userService.companyApi.update({
            id: companyID,
            ...CompanyFactory.build(),
            accountData: { accountID: subAccountResponse.data.id }
          });
          expect(companyResponse.status).to.be.eq(StatusCodes.OK);

          companyResponse = await billingTestHelper.userService.companyApi.readById(companyID);
          expect(companyResponse.data.accountData.accountID).to.eq(subAccountResponse.data.id);
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
          let siteResponse = await billingTestHelper.userService.siteApi.create({
            ...SiteFactory.build(),
            companyID: companyResponse.data.id,
            accountData: {
              accountID: subAccountResponse.data.id
            }
          });
          expect(siteResponse.status).to.be.eq(StatusCodes.OK);
          siteResponse = await billingTestHelper.userService.siteApi.readById(siteResponse.data.id);
          expect(siteResponse.data.accountData.accountID).to.eq(subAccountResponse.data.id);
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

          siteResponse = await billingTestHelper.userService.siteApi.update({
            id: siteID,
            ...SiteFactory.build(),
            companyID: companyResponse.data.id,
            accountData: { accountID: subAccountResponse.data.id }
          });
          expect(siteResponse.status).to.be.eq(StatusCodes.OK);

          siteResponse = await billingTestHelper.userService.siteApi.readById(siteID);
          expect(siteResponse.data.accountData.accountID).to.eq(subAccountResponse.data.id);
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
          // const transfersResponse = await billingTestHelper.userService.billingApi.readTransfers({},{ limit: 1, skip: 0 }, [{ field: '-createdOn' }]);
          const transfersResponse = await billingTestHelper.userService.billingApi.readTransfers({ ID: transferID });
          expect(transfersResponse.status).to.be.eq(StatusCodes.OK);
          const savedTransfer = transfersResponse.data.result?.[0];
          expect(savedTransfer).not.to.be.null;
          delete savedTransfer.createdOn;
          delete savedTransfer.createdBy;
          delete savedTransfer.lastChangedOn;
          delete savedTransfer.lastChangedBy;
          expect(savedTransfer).to.containSubset(transfer);
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
        const activationResponse = await billingTestHelper.userService.billingApi.activateSubAccount({ accountID: '5ce249a1a39ae1c056c389bd', TenantID: billingTestHelper.tenantContext.getTenant().id });
        expect(activationResponse.status).to.be.eq(StatusCodes.NOT_FOUND);
      });

      it('should not be able to list sub-accounts', async () => {
        const subAccountsResponse = await billingTestHelper.userService.billingApi.readSubAccounts({});
        expect(subAccountsResponse.status).to.be.eq(StatusCodes.FORBIDDEN);
      });

      it('should not be able to read sub-account', async () => {
        // List sub-accounts
        const subAccountResponse = await billingTestHelper.userService.billingApi.readSubAccount('62978713f146ea8cb3bf8a95');
        expect(subAccountResponse.status).to.be.eq(StatusCodes.FORBIDDEN);
      });

      it('should not be able to send sub-account onboarding', async () => {
        // List sub-accounts
        const subAccountResponse = await billingTestHelper.userService.billingApi.sendSubAccountOnboarding('62978713f146ea8cb3bf8a95');
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

    describe('Transfer of Funds', () => {
      // eslint-disable-next-line @typescript-eslint/require-await
      beforeAll(async () => {
        billingTestHelper.initUserContextAsAdmin();
        // Initialize the charging station context
        await billingTestHelper.initChargingStationContext2TestChargingTime();
      });

      it('should create an invoice, and get transfers generated', async () => {
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

  // describe('Billing Test Data Cleanup (utbilling)', () => {
  //   beforeAll(async () => {
  //     await stripeTestHelper.initialize();
  //   });

  //   describe('with a STRIPE live account (a fake one!)', () => {
  //     beforeAll(async () => {
  //       await stripeTestHelper.fakeLiveBillingSettings();
  //     });

  //     it('should NOT cleanup all billing test data', async () => {
  //       await stripeTestHelper.checkTestDataCleanup(false);
  //     });
  //   });

  //   describe('with a STRIPE test account', () => {
  //     beforeAll(async () => {
  //       await stripeTestHelper.setBillingSystemValidCredentials(true);
  //     });

  //     it('should cleanup all billing test data', async () => {
  //       await stripeTestHelper.checkTestDataCleanup(true);
  //     });
  //   });
  // });

});
