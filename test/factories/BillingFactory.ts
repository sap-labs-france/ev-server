import { BillingPlatformFeeStrategy, BillingTransfer, BillingTransferStatus } from '../../src/types/Billing';

import { Factory } from 'rosie';
import faker from 'faker';

export const BillingTransferFactory = Factory.define<BillingTransfer>('billingtransfer')
  .attr('collectedFunds', () => faker.datatype.number({ min: 70, max: 79 }))
  .attr('collectedFlatFees', () => 0)
  .attr('collectedFees', () => faker.datatype.number({ min: 0.7, max: 0.79 }))
  .attr('totalConsumptionWh', () => faker.datatype.number({ min: 10000, max: 90000 }))
  .attr('totalDurationSecs', () => faker.datatype.number({ min: 3600, max: 7200 }))
  .attr('accountID', () => faker.datatype.hexaDecimal(24).substring(2).toLowerCase())
  .attr('status', () => faker.random.arrayElement([BillingTransferStatus.DRAFT, BillingTransferStatus.PENDING, BillingTransferStatus.FINALIZED, BillingTransferStatus.TRANSFERRED]))
  .attr('transferAmount', null)
  .attr('transferExternalID', () => null)
  .attr('platformFeeData', () => ({
    feeAmount: 0,
    feeTaxAmount: 0
  }));

export const BillingPlatformFeeStrategyFactory = Factory.define<BillingPlatformFeeStrategy>('billingplatformfeestrategy')
  .attr('flatFeePerSession', () => 0.5)
  .attr('percentage', () => 3);
