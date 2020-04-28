import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import RefundIntegration from './RefundIntegration';
import { RefundSetting } from '../../types/Setting';
import { ServerAction } from '../../types/Server';
import Transaction from '../../types/Transaction';

const MODULE_NAME = 'DummyRefund';

export default class DummyRefundIntegration extends RefundIntegration<RefundSetting> {
  constructor(tenantID: string, setting: RefundSetting) {
    super(tenantID, setting);
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

  public async refund(tenantID: string, userId: string, transactions: Transaction[]): Promise<any> {}

  public canBeDeleted(transaction: Transaction): any {}

  public async updateRefundStatus(id: string, transaction: Transaction): Promise<any> {}

  public async createConnection(userId: string, data: any): Promise<any> {}
}
