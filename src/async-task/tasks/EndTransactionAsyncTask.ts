import AbstractAsyncTask from '../AsyncTask';
import ChargingStationStorage from '../../storage/mongodb/ChargingStationStorage';
import Configuration from '../../utils/Configuration';
import Logging from '../../utils/Logging';
import OCPPService from '../../server/ocpp/services/OCPPService';
import { OCPPStatusNotificationRequestExtended } from '../../types/ocpp/OCPPServer';
import { ServerAction } from '../../types/Server';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import TransactionStorage from '../../storage/mongodb/TransactionStorage';

export default class EndTransactionAsyncTask extends AbstractAsyncTask {
  protected async executeAsyncTask(): Promise<void> {
    const tenant = await TenantStorage.getTenant(this.getAsyncTask().tenantID);
    try {
      // Get the Transaction to bill
      const transactionID: string = this.getAsyncTask().parameters.transactionID;
      const transaction = await TransactionStorage.getTransaction(tenant, Number(transactionID), {}, [ 'id', 'stop' ]);
      const statusNotification: OCPPStatusNotificationRequestExtended = this.getAsyncTask().parameters.statusNotification;
      if (!transaction) {
        throw new Error(`Unknown Transaction ID '${transactionID}'`);
      }
      if (!transaction.stop) {
        throw new Error(`Unexpected situation - the transaction has not been stopped - Transaction ID '${transactionID}'`);
      }
      if (!statusNotification.status
        || !statusNotification.chargeBoxID
        || !statusNotification.connectorId) {
        throw new Error('Unexpected situation - the status notification is inconsistent');
      }
      // Instantiate the OCPPService
      const ocppService = new OCPPService(Configuration.getChargingStationConfig());
      const chargingStation = await ChargingStationStorage.getChargingStation(tenant, statusNotification.chargeBoxID, { withSiteArea: true, issuer: true });
      if (!chargingStation) {
        throw new Error(`Unexpected situation - the charging station does not exist - Charging Station ID '${statusNotification.chargeBoxID}'`);
      }
      // Let's trigger  again the status notification to 'finalize' the transaction
      await ocppService.simulateConnectorStatusNotification(tenant, chargingStation, statusNotification);
    } catch (error) {
      await Logging.logActionExceptionMessage(tenant.id, ServerAction.OCPP_STATUS_NOTIFICATION, error);
    }
  }
}
