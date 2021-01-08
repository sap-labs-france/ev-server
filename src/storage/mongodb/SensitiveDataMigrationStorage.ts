import { SensitiveDataMigrationState, SettingSensitiveData } from '../../types/SensitiveData';

import BackendError from '../../exception/BackendError';
import Constants from '../../utils/Constants';
import Cypher from '../../utils/Cypher';
import DatabaseUtils from './DatabaseUtils';
import { ObjectID } from 'mongodb';
import Utils from '../../utils/Utils';
import global from './../../types/GlobalType';

const MODULE_NAME = 'SensitiveDataMigrationStorage';

export default class SensitiveDataMigrationStorage {
  private static migrationId: ObjectID;

  public static async setMigrationId(migrationId?: string): Promise<void> {
    if (migrationId && migrationId !== null) {
      this.migrationId = Utils.convertToObjectID(migrationId);
    } else {
      this.migrationId = new ObjectID();
    }
  }

  public static async saveSensitiveData(tenantID: string, migrationToSave: SettingSensitiveData): Promise<string> {
    // Get migration if exists
    const migration = await this.getSensitiveDataMigration(tenantID);
    let migrationMDB: any;
    // Check if migration is provided
    if (!migrationToSave) {
      throw new BackendError({
        source: Constants.CENTRAL_SERVER,
        module: MODULE_NAME,
        method: 'saveSensitiveData',
        message: 'Migration not provided'
      });
    }
    if (migration) {
      // Add new setting migration to current migration
      migration.settingSensitiveData.push(migrationToSave);
      migrationMDB = {
        _id: this.migrationId,
        timestamp: new Date(),
        name: tenantID,
        version: 'partial',
        settingSensitiveData: migration.settingSensitiveData
      };
    } else {
      // Create new
      migrationMDB = {
        _id: this.migrationId,
        timestamp: new Date(),
        name: tenantID,
        version: 'partial',
        settingSensitiveData: [migrationToSave]
      };

      // If create new migration, save migrationId in Settings
      await Cypher.saveMigrationId(tenantID, this.migrationId.toHexString());
    }
    // Check Tenant
    await DatabaseUtils.checkTenant(tenantID);
    // Save document
    await global.database.getCollection<any>(tenantID, 'sensitivedatamigrations').findOneAndUpdate(
      { _id: migrationMDB._id },
      { $set: migrationMDB },
      { upsert: true, returnOriginal: false });
    return migrationMDB._id.toHexString();
  }

  public static async getSensitiveDataMigration(tenantID: string): Promise<SensitiveDataMigrationState> {
    // Check Tenant
    await DatabaseUtils.checkTenant(tenantID);
    // Get document
    const sensitiveDataMigrationState = await global.database.getCollection<SensitiveDataMigrationState>(tenantID, 'sensitivedatamigrations').findOne({
      _id: this.migrationId
    });
    return sensitiveDataMigrationState;
  }
}
