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
      });

      after(async () => {
        // Cleanup of the utbilling tenant is useless
        // Anyway, there is no way to cleanup the utbilling stripe account!
      });

      it('Should add a payment method to BILLING-TEST user', async () => {
        await testData.assignPaymentMethod('tok_visa');
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
        // Next step should not be necessary
        // await testData.billingImpl.synchronizeInvoices(testData.dynamicUser);
        // Let's check that the user do not have any DRAFT invoice anymore
        await testData.checkForDraftInvoices(testData.dynamicUser.id, 0);
      });

      it('Should add a different payment method to BILLING-TEST user', async () => {
        await testData.assignPaymentMethod('tok_fr');
      });

      it('Should set VAT tax rate to 20% (non inclusive)', async () => {
        await testData.assignTaxRate(20);
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
        // Next step should not be necessary
        // await testData.billingImpl.synchronizeInvoices(testData.dynamicUser);
        // Let's check that the user do not have any DRAFT invoice anymore
        await testData.checkForDraftInvoices(testData.dynamicUser.id, 0);
      });


    });

  });

});
