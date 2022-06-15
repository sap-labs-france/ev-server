import { BillingTransferStatus } from '../../src/types/Billing';
import { Factory } from 'rosie';
import faker from 'faker';

export const BillingTransferFactory = Factory.define('billingtransfer')
  .attr('amount', () => faker.datatype.number())
  .attr('accountID', () => faker.datatype.hexaDecimal(24).substring(2).toLowerCase())
  .attr('status', () => faker.random.arrayElement([BillingTransferStatus.DRAFT, BillingTransferStatus.PENDING, BillingTransferStatus.TRANSFERRED]))
  .attr('transferredAmount', () => faker.datatype.number())
  .attr('transferExternalID', () => faker.datatype.uuid())
  .attr('platformFeeData', () => ({
    feeAmount: faker.datatype.number(),
    feeTaxAmount: faker.datatype.number(),
    taxExternalID: faker.datatype.uuid(),
    invoiceExternalID: faker.datatype.uuid(),
  }))
  .attr('sessions', () =>
    [BillingTransferSessionFactory.build()]);

export const BillingTransferSessionFactory = Factory.define('billingtransfersession')
  .attr('transactionID', () => faker.datatype.number())
  .attr('amount', () => faker.datatype.number())
  .attr('platformFee', () => ({
    flatFeePerSession: faker.datatype.number(),
    percentage: faker.datatype.number(),
  }));
