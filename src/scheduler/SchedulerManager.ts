import AssetGetConsumptionTask from './tasks/AssetGetConsumptionTask';
import AsyncTaskCheckTask from './tasks/AsyncTaskCheckTask';
import BillingPeriodicOperationTask from './tasks/BillingPeriodicOperationTask';
import CheckAndComputeSmartChargingTask from './tasks/CheckAndComputeSmartChargingTask';
import CheckChargingStationTemplateTask from './tasks/CheckChargingStationTemplateTask';
import CheckOfflineChargingStationsTask from './tasks/CheckOfflineChargingStationsTask';
import CheckPreparingSessionNotStartedTask from './tasks/CheckPreparingSessionNotStartedTask';
import CheckSessionNotStartedAfterAuthorizeTask from './tasks/CheckSessionNotStartedAfterAuthorizeTask';
import CheckUserAccountInactivityTask from './tasks/CheckUserAccountInactivityTask';
import Configuration from '../utils/Configuration';
import Constants from '../utils/Constants';
import Logging from '../utils/Logging';
import LoggingDatabaseTableCleanupTask from './tasks/LoggingDatabaseTableCleanupTask';
import MigrateSensitiveDataTask from './tasks/MigrateSensitiveDataTask';
import OCPICheckCdrsTask from './tasks/ocpi/OCPICheckCdrsTask';
import OCPICheckLocationsTask from './tasks/ocpi/OCPICheckLocationsTask';
import OCPICheckSessionsTask from './tasks/ocpi/OCPICheckSessionsTask';
import OCPIGetCdrsTask from './tasks/ocpi/OCPIGetCdrsTask';
import OCPIGetLocationsTask from './tasks/ocpi/OCPIGetLocationsTask';
import OCPIGetSessionsTask from './tasks/ocpi/OCPIGetSessionsTask';
import OCPIGetTokensTask from './tasks/ocpi/OCPIGetTokensTask';
import OCPIPushCdrsTask from './tasks/ocpi/OCPIPushCdrsTask';
import OCPIPushEVSEStatusesTask from './tasks/ocpi/OCPIPushEVSEStatusesTask';
import OICPPushEvseDataTask from './tasks/oicp/OICPPushEvseDataTask';
import OICPPushEvseStatusTask from './tasks/oicp/OICPPushEvseStatusTask';
import SchedulerTask from './SchedulerTask';
import { ServerAction } from '../types/Server';
import SynchronizeBillingInvoicesTask from './tasks/SynchronizeBillingInvoicesTask';
import SynchronizeBillingUsersTask from './tasks/SynchronizeBillingUsersTask';
import SynchronizeCarsTask from './tasks/SynchronizeCarsTask';
import SynchronizeRefundTransactionsTask from './tasks/SynchronizeRefundTransactionsTask';
import Utils from '../utils/Utils';
import cron from 'node-cron';

const MODULE_NAME = 'SchedulerManager';

export default class SchedulerManager {
  private static schedulerConfig = Configuration.getSchedulerConfig();

  public static async init(): Promise<void> {
    // Active?
    if (SchedulerManager.schedulerConfig.active) {
      // Log
      await Logging.logInfo({
        tenantID: Constants.DEFAULT_TENANT,
        action: ServerAction.SCHEDULER,
        module: MODULE_NAME, method: 'init',
        message: 'The Scheduler is active'
      });
      // Yes: init
      for (const task of SchedulerManager.schedulerConfig.tasks) {
        // Active?
        if (!task.active) {
          await Logging.logWarning({
            tenantID: Constants.DEFAULT_TENANT,
            action: ServerAction.SCHEDULER,
            module: MODULE_NAME, method: 'init',
            message: `The task '${task.name}' is inactive`
          });
          continue;
        }
        let schedulerTask: SchedulerTask;
        // Tasks
        switch (task.name) {
          case 'AsyncTaskCheckTask':
            schedulerTask = new AsyncTaskCheckTask();
            break;
          case 'LoggingDatabaseTableCleanupTask':
            schedulerTask = new LoggingDatabaseTableCleanupTask();
            break;
          case 'CheckUserAccountInactivityTask':
            schedulerTask = new CheckUserAccountInactivityTask();
            break;
          case 'CheckOfflineChargingStationsTask':
            // The task runs every five minutes
            schedulerTask = new CheckOfflineChargingStationsTask();
            break;
          case 'CheckPreparingSessionNotStartedTask':
            // The task runs every five minutes
            schedulerTask = new CheckPreparingSessionNotStartedTask();
            break;
          case 'OICPPushEVSEDataTask':
            schedulerTask = new OICPPushEvseDataTask();
            break;
          case 'OICPPushEvseStatusTask':
            schedulerTask = new OICPPushEvseStatusTask();
            break;
          case 'OCPIPushEVSEStatusesTask':
            schedulerTask = new OCPIPushEVSEStatusesTask();
            break;
          case 'OCPIGetCdrsTask':
            schedulerTask = new OCPIGetCdrsTask();
            break;
          case 'OCPIGetLocationsTask':
            schedulerTask = new OCPIGetLocationsTask();
            break;
          case 'OCPIGetSessionsTask':
            schedulerTask = new OCPIGetSessionsTask();
            break;
          case 'OCPICheckLocationsTask':
            schedulerTask = new OCPICheckLocationsTask();
            break;
          case 'OCPICheckSessionsTask':
            schedulerTask = new OCPICheckSessionsTask();
            break;
          case 'OCPICheckCdrsTask':
            schedulerTask = new OCPICheckCdrsTask();
            break;
          case 'OCPIGetTokensTask':
            schedulerTask = new OCPIGetTokensTask();
            break;
          case 'OCPIPushCdrsTask':
            schedulerTask = new OCPIPushCdrsTask();
            break;
          case 'SynchronizeRefundTransactionsTask':
            schedulerTask = new SynchronizeRefundTransactionsTask();
            break;
          case 'SynchronizeBillingUsersTask':
            schedulerTask = new SynchronizeBillingUsersTask();
            break;
          case 'SynchronizeBillingInvoicesTask':
            schedulerTask = new SynchronizeBillingInvoicesTask();
            break;
          case 'BillingPeriodicOperationTask':
            schedulerTask = new BillingPeriodicOperationTask();
            break;
          case 'SynchronizeCarsTask':
            schedulerTask = new SynchronizeCarsTask();
            break;
          case 'CheckSessionNotStartedAfterAuthorizeTask':
            schedulerTask = new CheckSessionNotStartedAfterAuthorizeTask();
            break;
          case 'CheckAndComputeSmartChargingTask':
            schedulerTask = new CheckAndComputeSmartChargingTask();
            break;
          case 'AssetGetConsumptionTask':
            schedulerTask = new AssetGetConsumptionTask();
            break;
          case 'CheckChargingStationTemplateTask':
            schedulerTask = new CheckChargingStationTemplateTask();
            break;
          case 'MigrateSensitiveDataTask':
            schedulerTask = new MigrateSensitiveDataTask();
            break;
          default:
            await Logging.logError({
              tenantID: Constants.DEFAULT_TENANT,
              action: ServerAction.SCHEDULER,
              module: MODULE_NAME, method: 'init',
              message: `The task '${task.name}' is unknown`
            });
        }
        if (schedulerTask) {
          // Handle number of instances
          let numberOfInstance = 1;
          if (Utils.objectHasProperty(task, 'numberOfInstance')) {
            numberOfInstance = task.numberOfInstance;
          }
          // Register
          for (let i = 0; i < numberOfInstance; i++) {
            cron.schedule(task.periodicity, async (): Promise<void> => await schedulerTask.run(task.name, task.config));
          }
          await Logging.logInfo({
            tenantID: Constants.DEFAULT_TENANT,
            action: ServerAction.SCHEDULER,
            module: MODULE_NAME, method: 'init',
            message: `The task '${task.name}' has been scheduled with periodicity ''${task.periodicity}'`
          });
        }
      }
    } else {
      // Log
      await Logging.logWarning({
        tenantID: Constants.DEFAULT_TENANT,
        action: ServerAction.SCHEDULER,
        module: MODULE_NAME, method: 'init',
        message: 'The Scheduler is inactive'
      });
    }
  }
}
