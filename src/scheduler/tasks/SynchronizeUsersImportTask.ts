import Ajv from 'ajv';
import Constants from '../../utils/Constants';
import SchedulerTask from '../SchedulerTask';
import { TaskConfig } from '../../types/TaskConfig';
import Tenant from '../../types/Tenant';
import { UserImportStatus } from '../../types/User';
import UserStorage from '../../storage/mongodb/UserStorage';
import fs from 'fs';
import global from '../../types/GlobalType';

const MODULE_NAME = 'SynchronizeUsersImportTask';

export default class SynchronizeUsersImportTask extends SchedulerTask {
  async processTenant(tenant: Tenant, config: TaskConfig): Promise<void> {

    const importedUsers = await UserStorage.getImportedUsers(tenant.id, { statuses: [UserImportStatus.UNKNOWN] }, Constants.DB_PARAMS_MAX_LIMIT);
    if (importedUsers.count > 0) {
      for (const importedUser of importedUsers.result) {
        const foundUser = await UserStorage.getUserByEmail(tenant.id, importedUser.email);
        if (foundUser) {
          importedUser.status = UserImportStatus.ERROR;
          await UserStorage.saveImportedUser(tenant.id, importedUser);
        } else {
          const user = {
            firstName: importedUser.firstName,
            name: importedUser.name.toUpperCase(),
            email: importedUser.email.toLowerCase(),
            locale: 'de_DE',
            issuer: true,
            deleted: false,
            role: importedUser.BASIC,
            status: importedUser.ACTIVE,
            createdBy: importedUser.importedBy,
            createdOn: new Date(),
            passwordWrongNbrTrials: 0,
            notificationsActive: true,
            notifications: {
              sendSessionStarted: true,
              sendOptimalChargeReached: true,
              sendEndOfCharge: true,
              sendEndOfSession: true,
              sendUserAccountStatusChanged: true,
              sendPreparingSessionNotStarted: true,
              sendUserAccountInactivity: true,
              sendSessionNotStarted: true,
              sendNewRegisteredUser: false,
              sendUnknownUserBadged: false,
              sendChargingStationStatusError: false,
              sendChargingStationRegistered: false,
              sendOcpiPatchStatusError: false,
              sendSmtpAuthError: false,
              sendOfflineChargingStations: false,
              sendBillingSynchronizationFailed: false,
              sendCarCatalogSynchronizationFailed: false,
              sendEndUserErrorNotification: false
            }
          };
          try {
            const userValidation = await this.validateUser(user);
            if (userValidation) {
              // Create
              await global.database.getCollection<any>(tenant.id, 'users')
                .insertOne(user);
              importedUser.status = UserImportStatus.IMPORTED;
              await UserStorage.saveImportedUser(tenant.id, importedUser);
            } else {
              importedUser.status = UserImportStatus.ERROR;
              await UserStorage.saveImportedUser(tenant.id, importedUser);
            }
          } catch (error) {
            importedUser.status = UserImportStatus.ERROR;
            await UserStorage.saveImportedUser(tenant.id, importedUser);
          }
        }
      }
    }
  }

  async validateUser(data?: any): Promise<boolean> {
    const userSchema: any = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/user/user-create-req.json`, 'utf8'));
    const ajv = new Ajv();
    const fnValidate = ajv.compile(userSchema);
    const valid = fnValidate(data);
    if (!valid) {
      return false;
      // Const errors = fnValidate.errors.map((error) => ({
      //   path: error.dataPath,
      //   message: error.message ? error.message : ''
      // }));
      // for (const error of errors) {
      //   if (error.path && error.path !== '') {
      //     console.log(`Property '${error.path}': ${error.message}`);
      //   } else {
      //     console.log(`Error: ${error.message}`);
      //   }
      // }
      // throw new Error('Schema validation: Invalid Json!');
    }
    return valid;
  }
}
