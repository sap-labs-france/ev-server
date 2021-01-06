import { SensitiveDataMigrationState, SettingSensitiveData } from '../../types/SensitiveData';

import BackendError from '../../exception/BackendError';
import Constants from '../../utils/Constants';
import DatabaseUtils from './DatabaseUtils';
import { ObjectID } from 'mongodb';
import Utils from '../../utils/Utils';
import global from './../../types/GlobalType';

const MODULE_NAME = 'SensitiveDataMigrationStorage';

export default class SensitiveDataMigrationStorage {
  public static async saveSensitiveData(tenantID: string, migrationToSave: SettingSensitiveData, migrationID?: string): Promise<string> {
    // Check Tenant
    await DatabaseUtils.checkTenant(tenantID);

    // Check if key is provided
    if (!migrationToSave) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME,
        method: 'saveSensitiveData',
        message: 'Migration not provided'
      });
    }
    const migrationFilter: any = {};
    // Build Request
    if (migrationToSave.id) {
      migrationFilter._id = Utils.convertToObjectID(migrationToSave.id);
    } else {
      migrationFilter._id = new ObjectID();
    }
    // Set
    const migrationMDB: any = {
      _id: migrationFilter._id,
      timestamp: new Date(),
      name: tenantID,
      version: 'partial',
      settingSensitiveData: migrationToSave
    };

    // Save document
    await global.database.getCollection<any>(tenantID, 'sensitivedatamigrations').findOneAndUpdate(
      migrationFilter,
      { $set: migrationMDB },
      { upsert: true, returnOriginal: false });

    return migrationFilter._id.toHexString();
  }
}
