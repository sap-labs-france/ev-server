import Tag, { ImportedTag } from '../../types/Tag';
import Tenant, { TenantComponents } from '../../types/Tenant';
import User, { ImportedUser, UserRole, UserStatus } from '../../types/User';

import Constants from '../../utils/Constants';
import Logging from '../../utils/Logging';
import NotificationHandler from '../../notification/NotificationHandler';
import { ServerAction } from '../../types/Server';
import Site from '../../types/Site';
import SiteStorage from '../../storage/mongodb/SiteStorage';
import TagStorage from '../../storage/mongodb/TagStorage';
import UserStorage from '../../storage/mongodb/UserStorage';
import Utils from '../../utils/Utils';

const MODULE_NAME = 'ImportHelper';

export default class ImportHelper {
  public async processImportedUser(tenant: Tenant, importedUser: ImportedUser, existingSites: Map<string, Site>): Promise<User> {
    // Get User
    let user = await UserStorage.getUserByEmail(tenant, importedUser.email);
    if (!user) {
      // Create User
      user = await this.createUser(tenant, importedUser);
    }
    if (Utils.isTenantComponentActive(tenant, TenantComponents.ORGANIZATION) && importedUser.siteIDs) {
      await this.processSiteAssignment(tenant, user, importedUser, existingSites);
    }
    return user;
  }

  public async processImportedTag(tenant: Tenant, importedTag: ImportedTag, existingSites: Map<string, Site>): Promise<Tag> {
    // Get Tag
    let tag = await TagStorage.getTag(tenant, importedTag.id, { withNbrTransactions: true });
    // Try to get Tag with Visual ID
    if (!tag && importedTag.visualID) {
      tag = await TagStorage.getTagByVisualID(tenant, importedTag.visualID, { withNbrTransactions: true });
    }
    // If one found lets update it else create new tag
    if (tag) {
      this.updateTag(tag, importedTag);
    } else {
      tag = this.createTag(importedTag);
    }
    // Save user if any and get the ID to assign current tag
    if (importedTag.email && importedTag.name && importedTag.firstName) {
      // Check & Import the User
      const user = await this.processImportedUser(tenant, importedTag as ImportedUser, existingSites);
      // Assign
      tag.userID = user.id;
      // Make this Tag default
      await TagStorage.clearDefaultUserTag(tenant, user.id);
      tag.default = true;
    }
    // Save the new Tag
    await TagStorage.saveTag(tenant, tag);
    return tag;
  }

  private updateTag(tag: Tag, importedTag: ImportedTag): void {
    // Check tag is already in use
    if (!tag.issuer) {
      throw new Error('Tag is not local to the organization');
    }
    if (tag.userID) {
      throw new Error('Tag is already assigned to a user');
    }
    if (tag.active) {
      throw new Error('Tag is already active');
    }
    if (tag.transactionsCount > 0) {
      throw new Error(`Tag is already used in ${tag.transactionsCount} transaction(s)`);
    }
    if (tag.id !== importedTag.id) {
      throw new Error('Tag Visual ID is already assigned to another tag');
    }
    // Update
    tag.visualID = importedTag.visualID;
    tag.active = importedTag.importedData?.autoActivateTagAtImport;
    tag.description = importedTag.description;
    tag.importedData = importedTag.importedData;
  }

  private createTag(importedTag: ImportedTag): Tag {
    // New Tag
    return {
      id: importedTag.id,
      visualID: importedTag.visualID,
      description: importedTag.description,
      issuer: true,
      active: importedTag.importedData?.autoActivateTagAtImport,
      createdBy: { id: importedTag.importedBy },
      createdOn: importedTag.importedOn,
      importedData: importedTag.importedData
    };
  }

  private async updateUser(tenant: Tenant, user: User, importedUser: ImportedUser): Promise<void> {
    // Check user is already in use
    if (!user.issuer) {
      throw new Error('User is not local to the organization');
    }
    // Update it
    user.name = importedUser.name;
    user.firstName = importedUser.firstName;
    await UserStorage.saveUser(tenant, user);
  }

  private async createUser(tenant: Tenant, importedUser: ImportedUser): Promise<User> {
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
    newUser.id = await UserStorage.saveUser(tenant, newUser);
    await UserStorage.saveUserRole(tenant, newUser.id, UserRole.BASIC);
    await UserStorage.saveUserStatus(tenant, newUser.id, UserStatus.PENDING);
    await this.sendNotifications(tenant, newUser);
    return newUser;
  }

  private async processSiteAssignment(tenant: Tenant, user: User, importedUser: ImportedUser, existingSites: Map<string, Site>): Promise<void> {
    // If we never got the sites from db -> construct array of existing sites
    if (existingSites.size === 0) {
      // Init Site collections
      const sites = await SiteStorage.getSites(tenant, {}, Constants.DB_PARAMS_MAX_LIMIT, ['id', 'name']);
      for (const site of sites.result) {
        existingSites.set(site.id, site);
      }
    }
    const importedSiteIDs = importedUser.siteIDs.split('|');
    for (const importedSiteID of importedSiteIDs) {
      const existingSite = existingSites.get(importedSiteID);
      if (existingSite) {
        // Assign Site
        await UserStorage.addSiteToUser(tenant, user.id, importedSiteID);
      } else {
        // Site does not exist
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

  private async sendNotifications(tenant: Tenant, user: User): Promise<void> {
    // Handle sending email for reseting password if user auto activated
    // Init Password info
    const resetHash = Utils.generateUUID();
    await UserStorage.saveUserPassword(tenant, user.id, { passwordResetHash: resetHash });
    // Generate new verificationToken
    const verificationToken = Utils.generateToken(user.email);
    // Save User Verification Account
    await UserStorage.saveUserAccountVerification(tenant, user.id, { verificationToken });
    // Build account verif email with reset password embeded
    const evseDashboardVerifyEmailURL = Utils.buildEvseURL(tenant.subdomain) +
      '/auth/verify-email?VerificationToken=' + verificationToken + '&Email=' + user.email + '&ResetToken=' + resetHash;
    // Send activate account link
    NotificationHandler.sendVerificationEmailUserImport(
      tenant,
      Utils.generateUUID(),
      user,
      {
        'tenantName': tenant.name,
        'user': user,
        'evseDashboardURL': Utils.buildEvseURL(tenant.subdomain),
        'evseDashboardVerifyEmailURL': evseDashboardVerifyEmailURL
      }
    ).catch((error) => {
      Logging.logPromiseError(error, tenant?.id);
    });
  }
}
