import moment from 'moment';
import Constants from '../../utils/Constants';
import DatabaseUtils from '../../storage/mongodb/DatabaseUtils';
import TSGlobal from '../../types/GlobalType';
import Logging from '../../utils/Logging';
import MigrationTask from '../MigrationTask';
import PricingStorage from '../../storage/mongodb/PricingStorage';
import Tenant from '../../entity/Tenant';

declare const global: TSGlobal;

export default class NormalizeTransactionsTask extends MigrationTask {
  async migrate() {
    const tenants = await Tenant.getTenants();

    for (const tenant of tenants.result) {
      await this.migrateTenant(tenant);
    }
  }

  async migrateTenant(tenant) {
    // eslint-disable-next-line no-undef
    const chargersWithNoSiteArea = new Set();
    let chargersWithNoSiteAreaTransactionCount = 0;
    // eslint-disable-next-line no-undef
    const chargersNotExisting = new Set();
    let chargersNotExistingTransactionCount = 0;
    // Create Aggregation
    const aggregation = [];
    // Filters
    aggregation.push({
      $match: {
        'stop': {
          $exists: true
        }
      }
    });
    // Add Charger
    aggregation.push({
      $lookup: {
        from: DatabaseUtils.getCollectionName(tenant.getID(), 'chargingstations'),
        localField: 'chargeBoxID',
        foreignField: '_id',
        as: 'chargeBox'
      }
    });
    aggregation.push({
      $unwind: { 'path': '$chargeBox', 'preserveNullAndEmptyArrays': true }
    });
    // Add Site Area
    aggregation.push({
      $lookup: {
        from: DatabaseUtils.getCollectionName(tenant.getID(), 'siteareas'),
        localField: 'chargeBox.siteAreaID',
        foreignField: '_id',
        as: 'siteArea'
      }
    });
    aggregation.push({
      $unwind: { 'path': '$siteArea', 'preserveNullAndEmptyArrays': true }
    });
    // Get the price
    const pricing = await PricingStorage.getPricing(tenant.getID());
    // Read all transactions
    const transactionsMDB = await global.database.getCollection<any>(tenant.getID(), 'transactions')
      .aggregate(aggregation)
      .toArray();
    // Process each transaction
    for (const transactionMDB of transactionsMDB) {
      const transaction: any = {};
      // Update field
      transaction.chargeBoxID = transactionMDB.chargeBoxID;
      transaction.connectorId = transactionMDB.connectorId;
      transaction.meterStart = transactionMDB.meterStart;
      transaction.timestamp = transactionMDB.timestamp;
      transaction.tagID = transactionMDB.tagID;
      transaction.userID = transactionMDB.userID;
      // ChargeBox Found?
      if (transactionMDB.chargeBox) {
        // Yes: Assigned to Site Area?
        if (transactionMDB.siteArea) {
          // Yes
          transaction.siteAreaID = transactionMDB.siteArea._id;
          transaction.siteID = transactionMDB.siteArea.siteID;
        } else {
          // No: add and log later
          chargersWithNoSiteArea.add(transactionMDB.chargeBoxID);
          chargersWithNoSiteAreaTransactionCount++;
        }
      } else {
        // Not found: add and log later
        chargersNotExisting.add(transactionMDB.chargeBoxID);
        chargersNotExistingTransactionCount++;
      }
      if (transactionMDB.hasOwnProperty('stateOfCharge')) {
        transaction.stateOfCharge = transactionMDB.stateOfCharge;
      } else {
        transaction.stateOfCharge = 0;
      }
      if (pricing) {
        transaction.price = 0;
        transaction.roundedPrice = 0;
        transaction.priceUnit = pricing.priceUnit;
        transaction.pricingSource = 'simple';
      } else {
        transaction.price = 0;
        transaction.roundedPrice = 0;
        transaction.priceUnit = '';
        transaction.pricingSource = '';
      }
      transaction.stop = {};
      transaction.stop.meterStop = transactionMDB.stop.meterStop;
      transaction.stop.timestamp = transactionMDB.stop.timestamp;
      transaction.stop.totalConsumption = transactionMDB.stop.totalConsumption;
      transaction.stop.totalInactivitySecs = transactionMDB.stop.totalInactivitySecs;
      if (transactionMDB.stop.hasOwnProperty('tagID')) {
        transaction.stop.tagID = transactionMDB.stop.tagID;
      } else {
        transaction.stop.tagID = transactionMDB.tagID;
      }
      if (transactionMDB.stop.hasOwnProperty('userID')) {
        transaction.stop.userID = transactionMDB.stop.userID;
      } else {
        transaction.stop.userID = transactionMDB.userID;
      }
      if (transactionMDB.stop.hasOwnProperty('totalDurationSecs')) {
        transaction.stop.totalDurationSecs = transactionMDB.stop.totalDurationSecs;
      } else {
        transaction.stop.totalDurationSecs = moment.duration(moment(transactionMDB.stop.timestamp).diff(moment(transactionMDB.timestamp))).asSeconds();
      }
      if (transactionMDB.stop.hasOwnProperty('stateOfCharge')) {
        transaction.stop.stateOfCharge = transactionMDB.stop.stateOfCharge;
      } else {
        transaction.stop.stateOfCharge = 0;
      }
      if (pricing) {
        transaction.stop.price = parseFloat((pricing.priceKWH * (transactionMDB.stop.totalConsumption / 1000)).toFixed(6));
        transaction.stop.roundedPrice = parseFloat((parseFloat(transaction.stop.price)).toFixed(2));
        transaction.stop.priceUnit = pricing.priceUnit;
        transaction.stop.pricingSource = 'simple';
      } else {
        transaction.stop.price = 0;
        transaction.stop.roundedPrice = 0;
        transaction.stop.priceUnit = '';
        transaction.stop.pricingSource = '';
      }
      // Save it
      await global.database.getCollection<any>(tenant.getID(), 'transactions').findOneAndReplace(
        { '_id': transactionMDB._id },
        transaction,
        { upsert: true, returnOriginal: false });
    }
    // Charger Not Found?
    if (chargersNotExisting.size > 0) {
      // Log
      Logging.logWarning({
        tenantID: Constants.DEFAULT_TENANT,
        source: 'NormalizeTransactionsTask', action: 'Migration',
        module: 'NormalizeTransactionsTask', method: 'migrate',
        message: `Tenant ${tenant.getName()} (${tenant.getID()}): ${chargersNotExisting.size} Charger(s) not found in ${chargersNotExistingTransactionCount} Transaction(s): ${Array.from(chargersNotExisting).join(', ')}`
      });
    }
    // Charger with no Site Area
    if (chargersWithNoSiteArea.size > 0) {
      // Log
      Logging.logWarning({
        tenantID: Constants.DEFAULT_TENANT,
        source: 'NormalizeTransactionsTask', action: 'Migration',
        module: 'NormalizeTransactionsTask', method: 'migrate',
        message: `Tenant ${tenant.getName()} (${tenant.getID()}): ${chargersWithNoSiteArea.size} Charger(s) with no Site Area in ${chargersWithNoSiteAreaTransactionCount} Transaction(s): ${Array.from(chargersWithNoSiteArea).join(', ')}`
      });
    }
  }

  getVersion() {
    return '1.2';
  }

  getName() {
    return 'NormalizeTransactions';
  }
}

