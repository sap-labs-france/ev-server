import AbstractAsyncTask from '../AsyncTask';
import ChargingStationStorage from '../../storage/mongodb/ChargingStationStorage';
import Configuration from '../../utils/Configuration';
import Logging from '../../utils/Logging';
import OCPPService from '../../server/ocpp/services/OCPPService';
import { ServerAction } from '../../types/Server';
import TenantStorage from '../../storage/mongodb/TenantStorage';
import TransactionStorage from '../../storage/mongodb/TransactionStorage';

export default class EndTransactionAsyncTask extends AbstractAsyncTask {
  protected async executeAsyncTask(): Promise<void> {
    const tenant = await TenantStorage.getTenant(this.getAsyncTask().tenantID);
    try {
      // Get the Transaction to bill
      const transactionID = Number(this.getAsyncTask().parameters.transactionID);
      const chargeBoxID: string = this.getAsyncTask().parameters.chargeBoxID;
      const connectorId = Number(this.getAsyncTask().parameters.connectorId);
      if (!transactionID || !connectorId || !chargeBoxID) {
        throw new Error('Unexpected situation - task parameters are not set');
      }
      const transaction = await TransactionStorage.getTransaction(tenant, Number(transactionID), {}, [ 'id', 'stop' ]);
      if (!transaction) {
        throw new Error(`Unknown Transaction ID '${transactionID}'`);
      }
      if (!transaction.stop) {
        throw new Error(`Unexpected situation - the transaction has not been stopped - Transaction ID '${transactionID}'`);
      }
      if (transaction.stop.extraInactivityComputed) {
        throw new Error(`Unexpected situation - the extra inactivity has already been computed  - Transaction ID '${transactionID}'`);
      }
      // Instantiate the OCPPService
      const ocppService = new OCPPService(Configuration.getChargingStationConfig());
      const chargingStation = await ChargingStationStorage.getChargingStation(tenant, chargeBoxID, { withSiteArea: true, issuer: true });
      if (!chargingStation) {
        throw new Error(`Unexpected situation - the charging station does not exist - Charging Station ID '${chargeBoxID}'`);
      }
      // Let's trigger the end of the transaction
      await ocppService.triggerEndTransaction(tenant, chargingStation, transactionID, connectorId);
    } catch (error) {
      await Logging.logActionExceptionMessage(tenant.id, ServerAction.OCPP_STATUS_NOTIFICATION, error);
    }
  }
}
