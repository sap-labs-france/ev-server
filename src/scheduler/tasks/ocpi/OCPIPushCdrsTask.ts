import Tenant, { TenantComponents } from '../../../types/Tenant';

import ChargingStationStorage from '../../../storage/mongodb/ChargingStationStorage';
import LockingHelper from '../../../locking/LockingHelper';
import LockingManager from '../../../locking/LockingManager';
import Logging from '../../../utils/Logging';
import OCPIFacade from '../../../server/ocpi/OCPIFacade';
import { ServerAction } from '../../../types/Server';
import TagStorage from '../../../storage/mongodb/TagStorage';
import { TaskConfig } from '../../../types/TaskConfig';
import TenantSchedulerTask from '../../TenantSchedulerTask';
import TransactionStorage from '../../../storage/mongodb/TransactionStorage';
import Utils from '../../../utils/Utils';
import global from '../../../types/GlobalType';

const MODULE_NAME = 'OCPIPushCdrsTask';

export default class OCPIPushCdrsTask extends TenantSchedulerTask {
  public async processTenant(tenant: Tenant, config: TaskConfig): Promise<void> {
    try {
      // Check if OCPI component is active
      if (Utils.isTenantComponentActive(tenant, TenantComponents.OCPI)) {
        // Get the lock
        const ocpiLock = await LockingHelper.acquireOCPIPushCpoCdrsLock(tenant.id);
        if (ocpiLock) {
          try {
            // Get all finished Transaction with no CDR
            const transactionsMDB: {_id: number}[] = await global.database.getCollection<{_id: number}>(tenant.id, 'transactions')
              .aggregate<{_id: number}>(
              [
                {
                  $match: {
                    issuer: true,
                    stop: { $exists: true },
                    ocpiData: { $exists: true },
                    'ocpiData.cdr': null
                  }
                },
                {
                  $project: { '_id': 1 }
                }
              ]).toArray();
            if (!Utils.isEmptyArray(transactionsMDB)) {
              await Logging.logInfo({
                tenantID: tenant.id,
                action: ServerAction.OCPI_CPO_PUSH_CDRS,
                module: MODULE_NAME, method: 'processTenant',
                message: `${transactionsMDB.length} Transaction's CDRs are going to be pushed to OCPI`,
              });
              for (const transactionMDB of transactionsMDB) {
                // Get the lock: Used to avoid collision with manual push or end of transaction push
                const ocpiTransactionLock = await LockingHelper.acquireOCPIPushCdrLock(tenant.id, transactionMDB._id);
                if (ocpiTransactionLock) {
                  try {
                    // Get Transaction
                    const transaction = await TransactionStorage.getTransaction(tenant, transactionMDB._id, { withUser: true });
                    if (!transaction) {
                      await Logging.logError({
                        tenantID: tenant.id,
                        action: ServerAction.OCPI_CPO_PUSH_CDRS,
                        module: MODULE_NAME, method: 'processTenant',
                        message: `Transaction ID '${transactionMDB._id}' not found`,
                      });
                      continue;
                    }
                    if (transaction.ocpiData?.cdr) {
                      await Logging.logInfo({
                        tenantID: tenant.id,
                        action: ServerAction.OCPI_CPO_PUSH_CDRS,
                        module: MODULE_NAME, method: 'processTenant',
                        message: `Transaction ID '${transactionMDB._id}' already has his CDR pushed`,
                      });
                      continue;
                    }
                    // Get Charging Station
                    const chargingStation = await ChargingStationStorage.getChargingStation(tenant, transaction.chargeBoxID, { withSiteArea: true });
                    if (!chargingStation) {
                      await Logging.logError({
                        tenantID: tenant.id,
                        action: ServerAction.OCPI_CPO_PUSH_CDRS,
                        module: MODULE_NAME, method: 'processTenant',
                        message: `Charging Station ID '${transaction.chargeBoxID}' not found`,
                      });
                      continue;
                    }
                    // Get Tag
                    const tag = await TagStorage.getTag(tenant, transaction.tagID);
                    if (!tag) {
                      await Logging.logError({
                        tenantID: tenant.id,
                        action: ServerAction.OCPI_CPO_PUSH_CDRS,
                        module: MODULE_NAME, method: 'processTenant',
                        message: `Tag ID '${transaction.tagID}' not found`,
                      });
                      continue;
                    }
                    // Roaming
                    await OCPIFacade.processEndTransaction(tenant, transaction, chargingStation, chargingStation.siteArea, transaction.user, ServerAction.OCPI_CPO_PUSH_CDRS);
                    // Save
                    await TransactionStorage.saveTransactionOcpiData(tenant, transaction.id, transaction.ocpiData);
                    await Logging.logInfo({
                      tenantID: tenant.id,
                      action: ServerAction.OCPI_CPO_PUSH_CDRS,
                      actionOnUser: (transaction.user ? transaction.user : null),
                      module: MODULE_NAME, method: 'processTenant',
                      message: `CDR of Transaction ID '${transaction.id}' has been pushed successfully`,
                      detailedMessages: { cdr: transaction.ocpiData.cdr }
                    });
                  } catch (error) {
                    await Logging.logError({
                      tenantID: tenant.id,
                      action: ServerAction.OCPI_CPO_PUSH_CDRS,
                      module: MODULE_NAME, method: 'processTenant',
                      message: `Failed to pushed the CDR of the Transaction ID '${transactionMDB._id}' to OCPI`,
                      detailedMessages: { error: error.stack, transaction: transactionMDB }
                    });
                  } finally {
                    await LockingManager.release(ocpiTransactionLock);
                  }
                }
              }
            }
          } finally {
            await LockingManager.release(ocpiLock);
          }
        }
      }
    } catch (error) {
      await Logging.logActionExceptionMessage(tenant.id, ServerAction.OCPI_CPO_PUSH_CDRS, error);
    }
  }
}

