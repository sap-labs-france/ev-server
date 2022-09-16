import global, { DatabaseCount, FilterParams } from '../../types/GlobalType';

import { ChargingStationTemplate } from '../../types/ChargingStation';
import ChargingStationValidatorStorage from '../validator/ChargingStationValidatorStorage';
import Constants from '../../utils/Constants';
import { DataResult } from '../../types/DataResult';
import DatabaseUtils from './DatabaseUtils';
import DbParams from '../../types/database/DbParams';
import Logging from '../../utils/Logging';
import Tenant from '../../types/Tenant';
import Utils from '../../utils/Utils';

const MODULE_NAME = 'ChargingStationTemplateStorage';

export default class ChargingStationTemplateStorage {
  public static async saveChargingStationTemplate(chargingStationTemplate: ChargingStationTemplate): Promise<string> {
    const startTime = Logging.traceDatabaseRequestStart();
    // Validate
    chargingStationTemplate.hash = Utils.hash(JSON.stringify(chargingStationTemplate));
    chargingStationTemplate.hashTechnical = Utils.hash(JSON.stringify(chargingStationTemplate.template.technical));
    chargingStationTemplate.hashCapabilities = Utils.hash(JSON.stringify(chargingStationTemplate.template.capabilities));
    chargingStationTemplate.hashOcppStandard = Utils.hash(JSON.stringify(chargingStationTemplate.template.ocppStandardParameters));
    chargingStationTemplate.hashOcppVendor = Utils.hash(JSON.stringify(chargingStationTemplate.template.ocppVendorParameters));
    const chargingStationTemplateMDB = ChargingStationValidatorStorage.getInstance().validateChargingStationTemplateSave(chargingStationTemplate);
    DatabaseUtils.switchIDToMongoDBID(chargingStationTemplateMDB);
    // Add Last Changed/Created props
    DatabaseUtils.addLastChangedCreatedProps(chargingStationTemplateMDB, chargingStationTemplate);
    // Modify
    await global.database.getCollection<any>(Constants.DEFAULT_TENANT_ID, 'chargingstationtemplates').findOneAndReplace(
      { _id: chargingStationTemplateMDB['_id'] },
      chargingStationTemplateMDB,
      { upsert: true });
    await Logging.traceDatabaseRequestEnd(Constants.DEFAULT_TENANT_OBJECT, MODULE_NAME, 'saveChargingStationTemplate', startTime, chargingStationTemplate);
    return chargingStationTemplateMDB['_id'];
  }

  public static async getChargingStationTemplates(
      params: { withUser?: boolean; search?: string; IDs?: string[];} = {},
      dbParams: DbParams, projectFields?: string[]): Promise<DataResult<ChargingStationTemplate>> {
    const startTime = Logging.traceDatabaseRequestStart();
    // Clone before updating the values
    dbParams = Utils.cloneObject(dbParams);
    // Check Limit
    dbParams.limit = Utils.checkRecordLimit(dbParams.limit);
    // Check Skip
    dbParams.skip = Utils.checkRecordSkip(dbParams.skip);
    // Create Aggregation
    const aggregation = [];
    // Set the filters
    const filters: FilterParams = {};
    if (params.search) {
      filters.$or = [
        { 'template.chargePointVendor': { $regex: params.search, $options: 'i' } },
        { 'template.extraFilters.chargePointModel': { $regex: params.search, $options: 'i' } },
        { 'template.extraFilters.chargeBoxSerialNumber': { $regex: params.search, $options: 'i' } },
      ];
    }
    // Handle the ID
    if (!Utils.isEmptyArray(params.IDs)) {
      filters._id = { $in: params.IDs.map((id) => DatabaseUtils.convertToObjectID(id)) };
    }
    // Filters
    if (filters) {
      aggregation.push({
        $match: filters
      });
    }
    // Limit records?
    if (!dbParams.onlyRecordCount) {
      // Always limit the nbr of record to avoid perfs issues
      aggregation.push({ $limit: Constants.DB_RECORD_COUNT_CEIL });
    }
    // Count Records
    const chargingStationTemplatesCountMDB = await global.database.getCollection<any>(Constants.DEFAULT_TENANT_ID, 'chargingstationtemplates')
      .aggregate([...aggregation, { $count: 'count' }], DatabaseUtils.buildAggregateOptions())
      .toArray() as DatabaseCount[];
    // Check if only the total count is requested
    if (dbParams.onlyRecordCount) {
      // Return only the count
      await Logging.traceDatabaseRequestEnd(Constants.DEFAULT_TENANT_OBJECT, MODULE_NAME, 'getChargingStationTemplates', startTime, aggregation, chargingStationTemplatesCountMDB);
      return {
        count: (chargingStationTemplatesCountMDB.length > 0 ? chargingStationTemplatesCountMDB[0].count : 0),
        result: []
      };
    }
    // Remove the limit
    aggregation.pop();
    // Rename ID
    DatabaseUtils.pushRenameDatabaseID(aggregation);
    // Sort
    if (!dbParams.sort) {
      dbParams.sort = { 'template.chargePointVendor': 1 };
    }
    aggregation.push({
      $sort: dbParams.sort
    });
    // Skip
    if (dbParams.skip > 0) {
      aggregation.push({ $skip: dbParams.skip });
    }
    // User
    if (params.withUser) {
      // Add Created By / Last Changed By
      DatabaseUtils.pushCreatedLastChangedInAggregation(Constants.DEFAULT_TENANT_ID, aggregation);
    }
    // Limit
    aggregation.push({
      $limit: dbParams.limit
    });
    // Project
    DatabaseUtils.projectFields(aggregation, projectFields);
    // Read DB
    const chargingStationTemplates = await global.database.getCollection<any>(Constants.DEFAULT_TENANT_ID, 'chargingstationtemplates')
      .aggregate<any>(aggregation, DatabaseUtils.buildAggregateOptions())
      .toArray() as ChargingStationTemplate[];
    await Logging.traceDatabaseRequestEnd(Constants.DEFAULT_TENANT_OBJECT, MODULE_NAME, 'getChargingStationTemplates', startTime, aggregation, chargingStationTemplates);
    return {
      count: DatabaseUtils.getCountFromDatabaseCount(chargingStationTemplatesCountMDB[0]),
      result: chargingStationTemplates
    };
  }

  public static async getChargingStationTemplate(id: string = Constants.UNKNOWN_OBJECT_ID,
      params: { withUser?: boolean } = {},
      projectFields?: string[]): Promise<ChargingStationTemplate> {
    const chargingStationTemplateMDB = await ChargingStationTemplateStorage.getChargingStationTemplates({
      IDs: [id],
      withUser: params.withUser,
    }, Constants.DB_PARAMS_SINGLE_RECORD, projectFields);
    return chargingStationTemplateMDB.count === 1 ? chargingStationTemplateMDB.result[0] : null;
  }

  public static async deleteChargingStationTemplate(tenant: Tenant, chargingStationTemplateID: string): Promise<void> {
    const startTime = Logging.traceDatabaseRequestStart();
    // Delete singular CST
    await global.database.getCollection<any>(Constants.DEFAULT_TENANT_ID, 'chargingstationtemplates')
      .deleteOne({ '_id': DatabaseUtils.convertToObjectID(chargingStationTemplateID) });
    await Logging.traceDatabaseRequestEnd(tenant, MODULE_NAME, 'deleteChargingStationTemplate', startTime, { chargingStationTemplateID });
  }
}
