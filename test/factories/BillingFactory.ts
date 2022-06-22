import { BillingPlatformFeeStrategy, BillingTransfer, BillingTransferSession, BillingTransferStatus } from '../../src/types/Billing';

import { Factory } from 'rosie';
import faker from 'faker';

export const BillingTransferFactory = Factory.define<BillingTransfer>('billingtransfer')
  .attr('totalAmount', () => faker.datatype.number())
  .attr('accountID', () => faker.datatype.hexaDecimal(24).substring(2).toLowerCase())
  .attr('status', () => faker.random.arrayElement([BillingTransferStatus.DRAFT, BillingTransferStatus.PENDING, BillingTransferStatus.FINALIZED, BillingTransferStatus.TRANSFERRED]))
  .attr('transferAmount', () => faker.datatype.number())
  .attr('transferExternalID', () => faker.datatype.uuid())
  .attr('platformFeeData', () => ({
    feeAmount: faker.datatype.number(),
    feeTaxAmount: faker.datatype.number(),
    taxExternalID: faker.datatype.uuid(),
    invoiceExternalID: faker.datatype.uuid(),
  }))
  .attr('sessions', () =>
    [BillingTransferSessionFactory.build()]);

export const BillingTransferSessionFactory = Factory.define<BillingTransferSession>('billingtransfersession')
  .attr('transactionID', () => faker.datatype.number())
  .attr('amount', () => faker.datatype.number())
  .attr('platformFeeStrategy', () => ({
    flatFeePerSession: faker.datatype.number(),
    percentage: faker.datatype.number(),
  }));

export const BillingPlatformFeeStrategyFactory = Factory.define<BillingPlatformFeeStrategy>('billingplatformfeestrategy')
  .attr('flatFeePerSession', () => faker.datatype.number())
  .attr('percentage', () => faker.datatype.number());
