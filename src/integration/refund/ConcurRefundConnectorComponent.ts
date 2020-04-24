import Utils from '../../utils/Utils';

const ConcurRefundConnectorComponent = Utils.isModuleAvailable(__dirname + '/concur/ConcurRefundConnector') ?
  require('./concur/ConcurRefundConnector').default :
  require('../../utils/DummyModule').default;

export default ConcurRefundConnectorComponent;
