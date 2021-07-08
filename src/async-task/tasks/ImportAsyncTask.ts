import User, { ImportedUser, UserRole, UserStatus } from '../../types/User';

import AbstractAsyncTask from '../AsyncTask';
import Constants from '../../utils/Constants';
import { ImportedTag } from '../../types/Tag';
import Logging from '../../utils/Logging';
import NotificationHandler from '../../notification/NotificationHandler';
import { ServerAction } from '../../types/Server';
import SiteStorage from '../../storage/mongodb/SiteStorage';
import Tenant from '../../types/Tenant';
import TenantComponents from '../../types/TenantComponents';
import UserStorage from '../../storage/mongodb/UserStorage';
import Utils from '../../utils/Utils';

const MODULE_NAME = 'ImportAsyncTask';

export default class ImportAsyncTask extends AbstractAsyncTask {
  // To store existing sites from db to avoid getting the sites erverytime
  existingSitesAutoAssignable: string[] = [];

  protected async processImportedUser(tenant: Tenant, importedUser: ImportedUser|ImportedTag): Promise<User> {
    // Existing Users
    let user = await UserStorage.getUserByEmail(tenant.id, importedUser.email);
    if (user) {
      // Check user is already in use
      if (!user.issuer) {
        throw new Error('User is not local to the organization');
      }
      // Update it
      user.name = importedUser.name;
      user.firstName = importedUser.firstName;
      await UserStorage.saveUser(tenant.id, user);
    } else {
      user = await this.createUser(tenant, importedUser);
    }
    if (importedUser.siteIDs && Utils.isTenantComponentActive(tenant, TenantComponents.ORGANIZATION)) {
      await this.processSiteAssignment(tenant, user, importedUser);
    }
    return user;
  }

  protected async createUser(tenant: Tenant, importedUser: ImportedUser|ImportedTag): Promise<User> {
    // New User
    const newUser = UserStorage.createNewUser() as User;
    // Set
    newUser.firstName = importedUser.firstName;
    newUser.name = importedUser.name;
    newUser.email = importedUser.email;
    newUser.createdBy = { id: importedUser.importedBy };
    newUser.createdOn = importedUser.importedOn;
    newUser.importedData = importedUser.importedData;
    // Save the new User
    newUser.id = await UserStorage.saveUser(tenant.id, newUser);
    // Role need to be set separately
    await UserStorage.saveUserRole(tenant.id, newUser.id, UserRole.BASIC);
    // Status need to be set separately
    await UserStorage.saveUserStatus(tenant.id, newUser.id, UserStatus.PENDING);
    await this.sendNotifications(tenant, newUser);
    return newUser;
  }

  protected async processSiteAssignment(tenant: Tenant, newUser: User, importedUser: ImportedUser|ImportedTag): Promise<void> {
    // if we never got the sites from db -> construct array of existing sites that are autoassignable
    if (this.existingSitesAutoAssignable.length === 0) {
      const sites = await SiteStorage.getSites(tenant, { withAutoUserAssignment: true }, Constants.DB_PARAMS_MAX_LIMIT);
      sites.result.map((site) => {
        this.existingSitesAutoAssignable.push(site.id);
      });
    }
    const importedSites = importedUser.siteIDs.split('|');
    for (const siteID of importedSites) {
      // if site exists and is autoassignable
      if (this.existingSitesAutoAssignable.includes(siteID)) {
        await UserStorage.addSiteToUser(tenant.id, newUser.id, siteID);
      } else {
        // if site does not exist OR is not assignable
        await Logging.logWarning({
          tenantID: tenant.id,
          action: ServerAction.USERS_IMPORT,
          module: MODULE_NAME, method: 'executeAsyncTask',
          message: `Cannot assign user to site ${siteID} as this site has not been found or does not allow autoassignment`
        });
      }
    }
  }

  protected async sendNotifications(tenant: Tenant, newUser: User): Promise<void> {
    // Handle sending email for reseting password if user auto activated
    // Init Password info
    const resetHash = Utils.generateUUID();
    await UserStorage.saveUserPassword(tenant.id, newUser.id, { passwordResetHash: resetHash });
    // Generate new verificationToken
    const verificationToken = Utils.generateToken(newUser.email);
    // Save User Verification Account
    await UserStorage.saveUserAccountVerification(tenant.id, newUser.id, { verificationToken });
    // Build account verif email with reset password embeded
    const evseDashboardVerifyEmailURL = Utils.buildEvseURL(tenant.subdomain) +
    '/verify-email?VerificationToken=' + verificationToken + '&Email=' +
    newUser.email + '&ResetToken=' + resetHash;
    // Send activate account link
    await NotificationHandler.sendVerificationEmailUserImport(
      tenant.id,
      Utils.generateUUID(),
      newUser,
      {
        'tenantName': tenant.name,
        'user': newUser,
        'evseDashboardURL': Utils.buildEvseURL(tenant.subdomain),
        'evseDashboardVerifyEmailURL': evseDashboardVerifyEmailURL
      });
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  protected async executeAsyncTask(): Promise<void> {
    // const tenant = await TenantStorage.getTenant(this.asyncTask.tenantID);
  }
}
