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
      // eslint-disable-next-line @typescript-eslint/require-await
      beforeAll(async () => {
        billingTestHelper.initUserContextAsAdmin();
        // Initialize the charging station context
        await billingTestHelper.initChargingStationContext2TestChargingTime();
      });

      it('should create an invoice, and get transfers generated', async () => {
        // -------------------------------------------------------------------------------------------------------------
        // -------------------------------------------------------------------------------------------------------------
        // -------------------------------------------------------------------------------------------------------------
        // -------------------------------------------------------------------------------------------------------------
        // TO DO - GENERATE SEVERAL TRANSACTIONS
        // -------------------------------------------------------------------------------------------------------------
        // - create and onboard two sub-accounts
        // - assign a sub-account at a company level (with a platform fee strategy)
        // - Override the sub-account at a site level (with a distinct platform fee strategy)
        // - Generate several transactions
        // - Make sure to select the periodic billing mode and generate DRAFT invoices
        // - Make sure to have several sessions per invoices
        // - Make sure each invoices targets SEVERAL SUB-ACCOUNTS
        // - force the periodic billing and thus GENERATE SEVERAL TRANSFERS
        // - finalize the transfers!!!!
        // - send the transfers to STRIPE to generate the real transfer of funds
        // -------------------------------------------------------------------------------------------------------------
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
