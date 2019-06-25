import Tenant from '../../entity/Tenant';
import PricingStorage from '../../storage/mongodb/PricingStorage';
import DatabaseUtils from '../../storage/mongodb/DatabaseUtils';
import moment from 'moment';
import Transaction from '../../entity/Transaction';
import Logging from '../../utils/Logging';
import Constants from '../../utils/Constants';
import Database from '../../utils/Database';
import pLimit from 'p-limit';
import MigrationTask from '../MigrationTask';
import global from'../../types/GlobalType';


const DEFAULT_CONSUMPTION_ATTRIBUTE = {
  unit: 'Wh',
  location: 'Outlet',
  measurand: 'Energy.Active.Import.Register',
  format: 'Raw',
  context: 'Sample.Periodic'
};
export default class CreateConsumptionsTask extends MigrationTask {
  public totalCount: any;
  public done: any;
  public startTime: any;

  async migrate() {
    const tenants = await Tenant.getTenants();

    for (const tenant of tenants.result) {
      await this.migrateTenant(tenant);
    }
  }

  async migrateTenant(tenant) {
    this.totalCount = 0;
    this.done = 0;
    this.startTime = moment();
    // Create Aggregation
    const aggregation = [];
    // Filters
    aggregation.push({
      $match: {
        "stop": {
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
      $unwind: { "path": "$chargeBox", "preserveNullAndEmptyArrays": true }
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
      $unwind: { "path": "$siteArea", "preserveNullAndEmptyArrays": true }
    });
    // Add Consumption
    aggregation.push({
      $lookup: {
        from: DatabaseUtils.getCollectionName(tenant.getID(), 'consumptions'),
        localField: '_id',
        foreignField: 'transactionId',
        as: 'consumptions'
      }
    });
    aggregation.push({
      $match: { "consumptions": { $eq: [] } }
    });
    // Read all transactions
    const transactionsMDB = await global.database.getCollection<any>(tenant.getID(), 'transactions')
      .aggregate(aggregation).toArray();
    // Add Site ID and Site Area ID in Transaction
    const transactions = transactionsMDB.map((transaction) => {
      // Create
      return new Transaction(tenant.getID(), transaction);
    });
    // Get the price
    const pricing = await PricingStorage.getPricing(tenant.getID());
    // Limit promise execution in //
    const limit = pLimit(1);
    this.totalCount = transactions.length;
    // Create promises
    const promises = transactions.map(
      (transaction) => {
        return limit(async () => {
          try {
          // Compute
            await this.computeConsumptions(transaction, pricing);
          } catch (error) {
            Logging.logError({
              tenantID: Constants.DEFAULT_TENANT,
              source: "CreateConsumptionsTask", action: "Migration",
              module: "CreateConsumptionsTask", method: "migrate",
              message: `Tenant ${tenant.getName()} (${tenant.getID()}): Transaction ID '${transaction.getID()}' failed to migrate`
            });
          }
        });
      }
    );
    // Execute them all
    // eslint-disable-next-line no-undef
    await Promise.all(promises);
    // Get the end time
    const endTime = moment();
    // Log
    if (transactions.length > 0) {
      Logging.logInfo({
        tenantID: Constants.DEFAULT_TENANT,
        source: "CreateConsumptionsTask", action: "Migration",
        module: "CreateConsumptionsTask", method: "migrate",
        message: `Tenant ${tenant.getName()} (${tenant.getID()}): ${transactions.length} transactions migrated after ${moment.duration(endTime.diff(this.startTime)).format("mm:ss.SS", { trim: false })}`
      });
    }
  }

  async computeConsumptions(transaction, pricing) {
    let lastConsumption = null;
    const newConsumptions = [];
    // Get the consumption (old method)
    const consumptions = await this.getConsumptions(transaction);
    // Build the new consumptions
    for (const consumption of consumptions) {
      // Create the consumption
      const newConsumption: any = {
        "userID" : transaction.getUserID(),
        "chargeBoxID" : transaction.getChargeBoxID(),
        "siteID" : transaction.getSiteID(),
        "siteAreaID" : transaction.getSiteAreaID(),
        "connectorId" : transaction.getConnectorId(),
        "transactionId" : transaction.getID(),
        "startedAt" : (lastConsumption ? lastConsumption.endedAt : transaction.getStartDate()),
        "endedAt" : consumption.date,
        "cumulatedConsumption" : consumption.cumulated,
        "stateOfCharge": consumption.stateOfCharge,
        "consumption" : consumption.valueWh,
        "instantPower" : Math.round(consumption.value),
        "totalInactivitySecs": (lastConsumption ? lastConsumption.totalInactivitySecs : 0)
      };
      // Check that there is a duration
      if (newConsumption.startedAt.toString() === newConsumption.endedAt.toString()) {
        continue;
      }
      // Check inactivity
      if (consumption.value === 0) {
        // Set it
        consumption.totalInactivitySecs += moment(consumption.endedAt).diff(consumption.startedAt, 's');
      }
      // Check Pricing
      if (pricing) {
        // Compute
        newConsumption.pricingSource = "simple";
        newConsumption.amount = ((consumption.valueWh / 1000) * pricing.priceKWH).toFixed(6);
        newConsumption.roundedAmount = (parseFloat(newConsumption.amount)).toFixed(2);
        newConsumption.currencyCode = pricing.priceUnit;
        if (lastConsumption) {
          // Add
          newConsumption.cumulatedAmount = (parseFloat(lastConsumption.cumulatedAmount) + parseFloat(newConsumption.amount)).toFixed(6);
        } else {
          // Init
          newConsumption.cumulatedAmount = newConsumption.amount;
        }
      }
      // Keep
      lastConsumption = newConsumption;
      // Add
      newConsumptions.push(newConsumption);
    }
    // Save All
    await this.insertMany(transaction.getTenantID(), newConsumptions);
  }

  async insertMany(tenantID, consumptions) {
    // Transfer
    const consumptionsMDB = consumptions.map((consumption) => {
      const consumptionMDB: any = {};
      // Update
      Database.updateConsumption(consumption, consumptionMDB, false);
      // Return
      return consumptionMDB;
    });
    // Insert
    await global.database.getCollection<any>(tenantID, 'consumptions').insertMany(consumptionsMDB);
  }

  async getConsumptions(transaction) {
    let firstMeterValue = false;
    let lastMeterValue;
    let cumulatedConsumption = 0;
    const consumptions = [];
    // Get Meter Values
    const meterValues = await transaction.getMeterValues();
    // Add first Meter Value
    meterValues.splice(0, 0, {
      id: '666',
      connectorId: transaction.getConnectorId(),
      transactionId: transaction.getID(),
      timestamp: transaction.getStartDate(),
      value: transaction.getMeterStart(),
      attribute: DEFAULT_CONSUMPTION_ATTRIBUTE
    });
    // Add last Meter Value
    if (transaction.isFinished()) {
      // Add the missing Meter Value
      meterValues.push({
        id: '6969',
        connectorId: transaction.getConnectorId(),
        transactionId: transaction.getID(),
        timestamp: transaction.getStopDate(),
        value: transaction.getStopMeter(),
        attribute: DEFAULT_CONSUMPTION_ATTRIBUTE
      });
    }
    // Build the model
    for (let meterValueIndex = 0; meterValueIndex < meterValues.length; meterValueIndex++) {
      const meterValue = meterValues[meterValueIndex];
      // Meter Value Consumption?
      if (transaction.isConsumptionMeterValue(meterValue)) {
        // First value?
        if (!firstMeterValue) {
          // No: Keep the first value
          lastMeterValue = meterValue;
          // Ok
          firstMeterValue = true;
          // Calculate the consumption with the last value provided
        } else {
          // Last value is > ?
          if (lastMeterValue.value > meterValue.value) {
            // Yes: reinit it (the value has started over from 0)
            lastMeterValue.value = 0;
          }
          // Get the diff
          const diffSecs = moment(meterValue.timestamp).diff(lastMeterValue.timestamp, 's');
          // Sample multiplier
          const sampleMultiplier = 3600 / diffSecs;
          // Consumption
          const consumptionWh = meterValue.value - lastMeterValue.value;
          // Compute
          const currentConsumption = consumptionWh * sampleMultiplier;
          // Set cumulated
          cumulatedConsumption += consumptionWh;
          // Check last Meter Value
          if (consumptions.length > 0 &&
            consumptions[consumptions.length - 1].date.getTime() === meterValue.timestamp.getTime()) {
            // Same timestamp: Update the latest
            consumptions[consumptions.length - 1].value = currentConsumption;
            consumptions[consumptions.length - 1].valueWh = consumptionWh;
            consumptions[consumptions.length - 1].cumulated = cumulatedConsumption;
          } else {
            // Add the consumption
            consumptions.push({
              date: meterValue.timestamp,
              value: currentConsumption,
              cumulated: cumulatedConsumption,
              valueWh: consumptionWh
            });
          }
          lastMeterValue = meterValue;
        }
        // Meter Value State of Charge?
      } else if (transaction.isSocMeterValue(meterValue)) {
        // Set the last SoC

        consumptions[consumptions.length - 1].stateOfCharge = meterValue.value;
        // Check last Meter Value
        if (consumptions.length > 0 &&
          consumptions[consumptions.length - 1].date.getTime() === meterValue.timestamp.getTime()) {
          // Same timestamp: Update the latest
          consumptions[consumptions.length - 1].stateOfCharge = meterValue.value;
        } else {
          // Add the consumption
          consumptions.push({
            date: meterValue.timestamp,
            stateOfCharge: meterValue.value
          });
        }
      }
    }
    return consumptions;
  }

  isAsynchronous() {
    return true;
  }

  getVersion() {
    return "1.2";
  }

  getName() {
    return "CreateConsumptionsTask";
  }
}

