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

export default class ImportAsyncTask extends AbstractAsyncTask {
  // To store existing sites to avoid getting the site erverytime
  existingSitesToAutoAssign: Record<string, boolean> = {};
  // To store users by site
  // usersSite: Map<string, string[]> = new Map();
  usersSite: Record<string, string[]> = {};

  protected async processImportedUser(tenant: Tenant, importedUser: ImportedUser|ImportedTag): Promise<User> {
    // Existing Users
    let user = await UserStorage.getUserByEmail(tenant.id, importedUser.email);
    if (user) {
      // Check tag is already in use
      if (!user.issuer) {
        throw new Error('User is not local to the organization');
      }
      if (user.status !== UserStatus.PENDING) {
        throw new Error('User account is already in use');
      }
      // Update it
      user.name = importedUser.name;
      user.firstName = importedUser.firstName;
      await UserStorage.saveUser(tenant.id, user);
    } else {
      user = await this.createUser(tenant, importedUser);
    }
    if (importedUser.siteIDs && Utils.isTenantComponentActive(tenant, TenantComponents.ORGANIZATION)) {
      await this.checkSitesAndAssign(tenant, user, importedUser);
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
    await UserStorage.saveUserStatus(tenant.id, newUser.id, importedUser.importedData.autoActivateUserAtImport ? UserStatus.ACTIVE : UserStatus.INACTIVE);
    await this.sendNotifications(tenant, newUser);
    return newUser;
  }

  protected async checkSitesAndAssign(tenant: Tenant, newUser: User, importedUser: ImportedUser|ImportedTag): Promise<void> {
    let site: Site = null;
    // Saved sites for assignement
    const sitesToBeAssigned: string[] = [];
    const importedSites = importedUser.siteIDs.split('|');
    for (const siteID of importedSites) {
      if (siteID in this.existingSitesToAutoAssign) {
        // if siteID has already been checked and it's not already in the sitesToBeAssigned array
        if (this.existingSitesToAutoAssign[siteID] && !(Object.values(sitesToBeAssigned).includes(siteID))) {
          sitesToBeAssigned.push(siteID);
        }
        continue;
        // check if site exists
      } else if (!Utils.isNullOrUndefined(site = await SiteStorage.getSite(tenant, siteID))) {
        if (site.autoUserSiteAssignment) {
          this.existingSitesToAutoAssign[siteID] = true;
          sitesToBeAssigned.push(siteID);
        // if site exists but does not allow auto assignment
        } else {
          this.existingSitesToAutoAssign[siteID] = false;
          await Logging.logWarning({
            tenantID: tenant.id,
            action: ServerAction.USERS_IMPORT,
            module: MODULE_NAME, method: 'executeAsyncTask',
            message: `Site ${siteID} does not accept auto assignment`
          });
        }
      // if site does not exist
      } else {
        this.existingSitesToAutoAssign[siteID] = false;
        await Logging.logWarning({
          tenantID: tenant.id,
          action: ServerAction.USERS_IMPORT,
          module: MODULE_NAME, method: 'executeAsyncTask',
          message: `Cannot assign user to site ${siteID} as this site has not been found`
        });
      }
    }

    if (!Utils.isEmptyArray(sitesToBeAssigned)) {
      // To avoid useless call to storage
      const sitesToGet: string[] = [];
      for (const siteToBeAssigned of sitesToBeAssigned) {
        if (!Object.keys(this.usersSite).includes(siteToBeAssigned)) {
          sitesToGet.push(siteToBeAssigned);
          this.usersSite[siteToBeAssigned] = [];
        }
      }
      // Get list of userSites from sites we don't already have in this.userSites
      if (sitesToGet.length > 0) {
        const allSitesUsers = await SiteStorage.getSiteUsers(tenant, {
          siteIDs: sitesToGet
        }, {
          limit: Constants.IMPORT_PAGE_SIZE, skip: 0
        },
        [ 'userID', 'siteID']
        );
        // create the map <siteID : [userids]>
        for (const userSite of allSitesUsers.result) {
          this.usersSite[userSite.siteID].push(userSite.userID);
        }
      }
    }
    for (const siteID of sitesToBeAssigned) {
      const index = this.usersSite[siteID].indexOf(newUser.id) || -1;
      if (index > -1) {
        sitesToBeAssigned.splice(index, 1);
      }
    }
    if (sitesToBeAssigned) {
      await UserStorage.addSitesToUser(tenant.id, newUser.id, sitesToBeAssigned);
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

