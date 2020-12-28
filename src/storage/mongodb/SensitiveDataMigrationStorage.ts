import { SensitiveDataMigrationState, SettingSensitiveData } from '../../types/SensitiveData';

import BackendError from '../../exception/BackendError';
import Constants from '../../utils/Constants';
import DatabaseUtils from './DatabaseUtils';
import { ObjectID } from 'mongodb';
import global from './../../types/GlobalType';

const MODULE_NAME = 'SensitiveDataMigrationStorage';

export default class SensitiveDataMigrationStorage {
  public static async saveSensitiveDataMigrationState(tenantID: string, migrationToSave: SensitiveDataMigrationState): Promise<void> {
    // Check Tenant
    await DatabaseUtils.checkTenant(tenantID);

    // Check if key is provided
    if (!migrationToSave) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME,
        method: 'saveSensitiveDataMigrationState',
        message: 'Migration not provided'
      });
    }

    // Set
    const migrationMDB: any = {
      _id: new ObjectID(),
      timestamp: migrationToSave.timestamp,
      name: migrationToSave.name,
      version: migrationToSave.version,
      settingSensitiveData: migrationToSave.settingSensitiveData
    };

    // Save document
    await global.database.getCollection<any>(tenantID, 'sensitivedatamigrations').insertOne(migrationMDB);
  }

  public static async saveSensitiveData(tenantID: string, migrationToSave: SettingSensitiveData): Promise<void> {
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

    // Set
    const migrationMDB: any = {
      _id: new ObjectID(),
      timestamp: new Date(),
      name: tenantID,
      version: 'partial',
      settingSensitiveData: migrationToSave
    };

    // Save document
    await global.database.getCollection<any>(tenantID, 'sensitivedatamigrations').insertOne(migrationMDB);
  }
}
