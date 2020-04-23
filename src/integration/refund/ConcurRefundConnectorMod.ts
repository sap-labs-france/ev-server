import Utils from '../../utils/Utils';

const ConcurRefundConnectorMod = Utils.isModuleAvailable(__dirname + '/concur/ConcurRefundConnector') ?
  require('./concur/ConcurRefundConnector').default :
  require('../../utils/DummyModule').default;

export default ConcurRefundConnectorMod;
