import chai, { assert, expect } from 'chai';

import MongoDBStorage from '../../src/storage/mongodb/MongoDBStorage';
import StripeIntegrationTestData from './BillingStripeTestData';
import chaiSubset from 'chai-subset';
import config from '../config';
import global from '../../src/types/GlobalType';
import responseHelper from '../helpers/responseHelper';

chai.use(chaiSubset);
chai.use(responseHelper);

const testData: StripeIntegrationTestData = new StripeIntegrationTestData();

describe('Billing Stripe Service', function() {
  // Do not run the tests when the settings are not properly set
  this.pending = !testData.isBillingProperlyConfigured();
  this.timeout(1000000);

  describe('With component Billing (tenant utbilling)', () => {
    before(async () => {
      global.database = new MongoDBStorage(config.get('storage'));
      await global.database.start();
      await testData.initialize();
    });

    describe('Where the admin user', () => {
      before(async () => {
        testData.billingImpl = await testData.setBillingSystemValidCredentials();
      });

      after(async () => {
        // TODO - cleanup test data!
        // Cleanup of the utbilling tenant is useless if we cannot cleanup the utbilling stripe account as well
      });

      it('Should add a payment method to BILLING-TEST user', async () => {
        const customerID: string = testData.billingUser.billingData.customerID;
        const stripe_test_token = 'tok_visa';
        await testData.assignPaymentMethod(customerID, stripe_test_token);
      });

      it('should create and pay a first invoice for BILLING-TEST user', async () => {
        await testData.checkForDraftInvoices(testData.dynamicUser.id, 0);
        // Let's create an INvoice with a first Item
        const dynamicInvoice = await testData.createDraftInvoice();
        // Let's add an second item to the same invoice
        await testData.updateDraftInvoice(dynamicInvoice);
        // User should have a DRAFT invoice
        const draftInvoices = await testData.getDraftInvoices(testData.dynamicUser.id);
        assert(draftInvoices, 'User should have at least a draft invoice');
        expect(draftInvoices.length).to.be.eql(1);
        // Let's pay that particular DRAFT invoice
        await testData.payDraftInvoice(draftInvoices[0]);
        // Let's check that the user do not have any DRAFT invoice anymore
        await testData.billingImpl.synchronizeInvoices(testData.dynamicUser);
        await testData.checkForDraftInvoices(testData.dynamicUser.id, 0);
      });

      it('Should add a different payment method to BILLING-TEST user', async () => {
        const customerID: string = testData.billingUser.billingData.customerID;
        const stripe_test_token = 'tok_fr';
        await testData.assignPaymentMethod(customerID, stripe_test_token);
      });

      it('should create and pay a second invoice for BILLING-TEST user', async () => {
        await testData.checkForDraftInvoices(testData.dynamicUser.id, 0);
        // Let's create an Invoice with a first Item
        const dynamicInvoice = await testData.createDraftInvoice();
        // Let's add an second item to the same invoice
        await testData.updateDraftInvoice(dynamicInvoice);
        // User should have a DRAFT invoice
        const draftInvoices = await testData.getDraftInvoices(testData.dynamicUser.id);
        assert(draftInvoices, 'User should have at least a draft invoice');
        expect(draftInvoices.length).to.be.eql(1);
        // Let's pay that particular DRAFT invoice
        await testData.payDraftInvoice(draftInvoices[0]);
        // Let's check that the user do not have any DRAFT invoice anymore
        await testData.billingImpl.synchronizeInvoices(testData.dynamicUser);
        await testData.checkForDraftInvoices(testData.dynamicUser.id, 0);
      });


    });

  });

});
