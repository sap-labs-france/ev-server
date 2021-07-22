import User, { ImportedUser, UserRole, UserStatus } from '../../types/User';

import AbstractAsyncTask from '../AsyncTask';
import Constants from '../../utils/Constants';
import { ImportedTag } from '../../types/Tag';
import Logging from '../../utils/Logging';
import NotificationHandler from '../../notification/NotificationHandler';
import { ServerAction } from '../../types/Server';
import Site from '../../types/Site';
import SiteStorage from '../../storage/mongodb/SiteStorage';
import Tenant from '../../types/Tenant';
import TenantComponents from '../../types/TenantComponents';
import UserStorage from '../../storage/mongodb/UserStorage';
import Utils from '../../utils/Utils';

const MODULE_NAME = 'ImportAsyncTask';

export default abstract class ImportAsyncTask extends AbstractAsyncTask {
  // To store existing sites from db to avoid getting the sites erverytime
  private existingAutoAssignableSites: Map<string, Site> = new Map();
  private existingSites: Map<string, Site> = new Map();

  protected async processImportedUser(tenant: Tenant, importedUser: ImportedUser|ImportedTag): Promise<User> {
    // Existing Users
    let user = await UserStorage.getUserByEmail(tenant.id, importedUser.email);
    if (user) {
      await this.updateUser(tenant, user, importedUser);
    } else {
      user = await this.createUser(tenant, importedUser);
    }
    if (Utils.isTenantComponentActive(tenant, TenantComponents.ORGANIZATION) && !Utils.isEmptyArray(importedUser.siteIDs)) {
      await this.processSiteAssignment(tenant, user, importedUser);
    }
    return user;
  }

  private async updateUser(tenant: Tenant, user: User, importedUser: ImportedUser|ImportedTag): Promise<void> {
    // Check user is already in use
    if (!user.issuer) {
      throw new Error('User is not local to the organization');
    }
    // Update it
    user.name = importedUser.name;
    user.firstName = importedUser.firstName;
    await UserStorage.saveUser(tenant.id, user);
  }

  private async createUser(tenant: Tenant, importedUser: ImportedUser|ImportedTag): Promise<User> {
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
    await UserStorage.saveUserRole(tenant.id, newUser.id, UserRole.BASIC);
    await UserStorage.saveUserStatus(tenant.id, newUser.id, UserStatus.PENDING);
    await this.sendNotifications(tenant, newUser);
    return newUser;
  }

  private async processSiteAssignment(tenant: Tenant, user: User, importedUser: ImportedUser|ImportedTag): Promise<void> {
    // If we never got the sites from db -> construct array of existing sites that are autoassignable
    if (Utils.isEmptyArray(this.existingAutoAssignableSites)) {
      // Init Site collections
      const sites = await SiteStorage.getSites(tenant, {}, Constants.DB_PARAMS_MAX_LIMIT, ['id', 'name', 'autoUserSiteAssignment']);
      for (const site of sites.result) {
        if (site.autoUserSiteAssignment) {
          this.existingAutoAssignableSites.set(site.id, site);
        }
        this.existingSites.set(site.id, site);
      }
    }
    const importedSiteIDs = importedUser.siteIDs.split('|');
    for (const importedSiteID of importedSiteIDs) {
      const existingAutoAssignableSite = this.existingAutoAssignableSites.get(importedSiteID);
      const existingSite = this.existingSites.get(importedSiteID);
      // Assign Site
      if (existingAutoAssignableSite) {
        await UserStorage.addSiteToUser(tenant.id, user.id, importedSiteID);
      // Site is not auto assignable
      } else if (existingSite) {
        await Logging.logWarning({
          tenantID: tenant.id,
          action: ServerAction.USERS_IMPORT,
          module: MODULE_NAME, method: 'executeAsyncTask',
          user,
          message: `Site '${existingSite.name}' with ID '${existingSite.id}' does not allow auto assignment`
        });
      // Site does not exist
      } else {
        await Logging.logError({
          tenantID: tenant.id,
          action: ServerAction.USERS_IMPORT,
          module: MODULE_NAME, method: 'executeAsyncTask',
          user,
          message: `Site ID '${importedSiteID}' does not exist`
        });
      }
    }
  }

  private async sendNotifications(tenant: Tenant, newUser: User): Promise<void> {
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
      '/verify-email?VerificationToken=' + verificationToken + '&Email=' + newUser.email + '&ResetToken=' + resetHash;
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
}
