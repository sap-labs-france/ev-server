import Constants from '../../../utils/Constants';
import Consumption from '../../../types/Consumption';
import Logging from '../../../utils/Logging';
import PricingIntegration from '../PricingIntegration';
import { PricingSetting } from '../../../types/Setting';
import { ServerAction } from '../../../types/Server';
import Transaction from '../../../types/Transaction';

const MODULE_NAME = 'DummyPricing';

export default class DummyPricingIntegration extends PricingIntegration<PricingSetting> {
  constructor(tenantID: string, readonly settings: PricingSetting) {
    super(tenantID, settings);
    const error = new Error();
    Logging.logDebug({
      tenantID: tenantID,
      source: Constants.CENTRAL_SERVER,
      action: ServerAction.INSTANTIATE_DUMMY_MODULE,
      module: MODULE_NAME, method: 'constructor',
      message: MODULE_NAME + ' have been instantiated, ensure its instantiation follow its proper usage',
      detailedMessages: { stack: error.stack }
    });
  }

  async startSession(transaction: Transaction, consumptionData: Consumption): Promise<any> {
  }

  async updateSession(transaction: Transaction, consumptionData: Consumption): Promise<any> {
  }

  async stopSession(transaction: Transaction, consumptionData: Consumption): Promise<any> {
  }
}
