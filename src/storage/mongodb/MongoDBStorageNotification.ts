import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import MongoDBStorage from './MongoDBStorage';

const _pipeline = [];
const _options = {
  'fullDocument': 'default'
};

export default class MongoDBStorageNotification {
  public dbConfig: any;
  public centralRestServer: any;
  public database: any;

  constructor(dbConfig, centralRestServer) {
    this.dbConfig = dbConfig;
    this.centralRestServer = centralRestServer;
  }

  static getActionFromOperation(operation) {
    if (operation) {
      switch (operation) {
        case 'insert':
          return Constants.ACTION_CREATE;
        case 'update':
        case 'replace':
          return Constants.ACTION_UPDATE;
        case 'delete':
          return Constants.ACTION_DELETE;
      }
    }
    return null;
  }

  static handleInvalidChange(tenantID, collection, change) {
    Logging.logError({
      tenantID: Constants.DEFAULT_TENANT,
      module: 'MongoDBStorageNotification',
      method: 'handleInvalidChange',
      action: 'Watch',
      message: `Invalid change received on collection ${tenantID}.${collection}`,
      detailedMessages: change
    });
  }

  static handleError(error) { // Log
    Logging.logError({
      tenantID: Constants.DEFAULT_TENANT,
      module: 'MongoDBStorageNotification',
      method: 'watchCollection', action: 'Watch',
      message: `Error occurred in watching database: ${error}`,
      detailedMessages: error
    });
  }

  async start() {
    if (this.dbConfig.monitorDBChange) {
      this.database = new MongoDBStorage(this.dbConfig);
      await this.database.start();

      // Check
      if (!this.centralRestServer) {
        return;
      }

      const dbChangeStream = await this.database.watch(_pipeline, _options);
      dbChangeStream.on('change', (change) => {
        const action = MongoDBStorageNotification.getActionFromOperation(change.operationType);
        let tenantID, collection, documentID;
        if (change.ns && change.ns.coll) {
          const namespaces = change.ns.coll.split('.');
          if (namespaces && namespaces.length === 2) {
            tenantID = namespaces[0];
            collection = namespaces[1];
          }
        }
        if (change.documentKey && change.documentKey._id) {
          documentID = change.documentKey._id.toString();
        }

        if (tenantID === Constants.DEFAULT_TENANT) {
          this.handleDefaultCollectionChange(collection, documentID, action);
        } else {
          this.handleTenantCollectionChange(tenantID, collection, documentID, action, change);
        }
      });

      dbChangeStream.on('error', (error) => {
        MongoDBStorageNotification.handleError(error);
      });

      Logging.logInfo({
        tenantID: Constants.DEFAULT_TENANT,
        module: 'MongoDBStorageNotification', method: 'start', action: 'Startup',
        message: `Starting to monitor changes on database ''${this.dbConfig.implementation}'...`
      });

      Logging.logInfo({
        tenantID: Constants.DEFAULT_TENANT,
        module: 'MongoDBStorageNotification', method: 'start', action: 'Startup',
        message: `The monitoring on database '${this.dbConfig.implementation}' is active`
      });
    } else {
      Logging.logInfo({
        tenantID: Constants.DEFAULT_TENANT,
        module: 'MongoDBStorageNotification', method: 'start', action: 'Startup',
        message: `The monitoring on database '${this.dbConfig.implementation}' is disabled`
      });
    }
  }

  handleDefaultCollectionChange(collection, documentID, action) {
    switch (collection) {
      case 'users':
      case 'userimages':
        this.centralRestServer.notifyUser(Constants.DEFAULT_TENANT, action, { id: documentID });
        break;
      case 'tenant':
        this.centralRestServer.notifyTenant(Constants.DEFAULT_TENANT, action, { id: documentID });
        break;
      case 'logs':
        this.centralRestServer.notifyLogging(Constants.DEFAULT_TENANT, action);
        break;
    }
  }

  handleTenantCollectionChange(tenantID, collection, documentID, action, changeEvent) {
    switch (collection) {
      case 'users':
      case 'userimages':
        this.centralRestServer.notifyUser(tenantID, action, { id: documentID });
        break;
      case 'chargingstations':
        this.centralRestServer.notifyChargingStation(tenantID, action, { id: documentID });
        break;
      case 'vehiclemanufacturers':
      case 'vehiclemanufacturerlogos':
        this.centralRestServer.notifyVehicleManufacturer(tenantID, action, { id: documentID });
        break;
      case 'vehicles':
      case 'vehicleimages':
        this.centralRestServer.notifyVehicle(tenantID, action, { id: documentID });
        break;
      case 'companies':
      case 'companylogos':
        this.centralRestServer.notifyCompany(tenantID, action, { id: documentID });
        break;
      case 'siteareas':
      case 'siteareaimages':
        this.centralRestServer.notifySiteArea(tenantID, action, { id: documentID });
        break;
      case 'sites':
      case 'siteimages':
        this.centralRestServer.notifySite(tenantID, action, { id: documentID });
        break;
      case 'transactions':
        this.handleTransactionChange(tenantID, documentID, action, changeEvent);
        break;
      case 'metervalues':
        this.handleMeterValuesChange(tenantID, documentID, action, changeEvent);
        break;
      case 'configurations':
        this.handleConfigurationChange(tenantID, documentID, action, changeEvent);
        break;
      case 'logs':
        this.centralRestServer.notifyLogging(tenantID, action);
        break;
    }
  }

  handleTransactionChange(tenantID, transactionID, action, changeEvent) {
    if (transactionID) {
      const notification: any = {
        'id': transactionID
      };
      // Operation
      switch (action) {
        case 'insert': // Insert/Create
          notification.connectorId = changeEvent.fullDocument.connectorId;
          notification.chargeBoxID = changeEvent.fullDocument.chargeBoxID;
          break;
        case 'update': // Update
          if (changeEvent.updateDescription && changeEvent.updateDescription.updatedFields && changeEvent.updateDescription.updatedFields.stop) {
            notification.type = Constants.ENTITY_TRANSACTION_STOP;
          }
          break;
        case 'replace': // Replace
          if (changeEvent.fullDocument && changeEvent.fullDocument.stop) {
            notification.type = Constants.ENTITY_TRANSACTION_STOP;
          }
          break;
      }
      // Notify
      this.centralRestServer.notifyTransaction(tenantID, action, notification);
    } else {
      MongoDBStorageNotification.handleInvalidChange(tenantID, 'transactions', changeEvent);
    }
  }

  handleMeterValuesChange(tenantID, metervaluesID, action, changeEvent) {
    if (metervaluesID) {
      const notification: any = {};
      // Insert/Create?
      if (action === Constants.ACTION_CREATE) {
        notification.id = changeEvent.fullDocument.transactionId;
        notification.type = Constants.ENTITY_TRANSACTION_METER_VALUES;
        notification.chargeBoxID = changeEvent.fullDocument.chargeBoxID;
        notification.connectorId = changeEvent.fullDocument.connectorId;
        // Notify, Force Transaction Update
        this.centralRestServer.notifyTransaction(tenantID, Constants.ACTION_UPDATE, notification);
      }
    } else {
      MongoDBStorageNotification.handleInvalidChange(tenantID, 'meterValues', changeEvent);
    }
  }

  handleConfigurationChange(tenantID, configurationID, action, changeEvent) {
    if (configurationID) {
      this.centralRestServer.notifyChargingStation(tenantID, action, {
        'type': Constants.NOTIF_TYPE_CHARGING_STATION_CONFIGURATION,
        'id': configurationID
      });
    } else {
      MongoDBStorageNotification.handleInvalidChange(tenantID, 'configurations', changeEvent);
    }
  }
}
