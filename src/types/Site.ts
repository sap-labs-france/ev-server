/* pragma import CreatedUpdatedProps from "./CreatedUpdatedProps";
import ChargingStation from "../entity/ChargingStation";
import Address from "./Address";

export default interface Site implements CreatedUpdatedProps {

    name: string;
    availableChargers: ChargingStation[] = [];
    totalChargers: ChargingStation[] = [];
    availableConnectors: number;
    totalConnectors: number;
    address: Address;
    companyID: string;
    siteare

  setAllowAllUsersToStopTransactionsEnabled(allowAllUsersToStopTransactions) {
    this._model.allowAllUsersToStopTransactions = allowAllUsersToStopTransactions;
  }

  isAllowAllUsersToStopTransactionsEnabled() {
    return this._model.allowAllUsersToStopTransactions;
  }

  setAutoUserSiteAssignment(active) {
    this._model.autoUserSiteAssignment = active;
  }

  isAutoUserSiteAssignmentEnabled() {
    return this._model.autoUserSiteAssignment;
  }

  setImage(image) {
    this._model.image = image;
  }

  getImage() {
    return this._model.image;
  }

  setCompany(company: Company) {
    if (company) {
      this._model.company = company;
      this._model.companyID = company.id;
    } else {
      this._model.company = null;
    }
  }


  async getUsers() {
    if (this._model.users) {
      return this._model.users.map((user) => new User(this.getTenantID(), user));
    } else {
      const users = await UserStorage.getUsers(this.getTenantID(), { 'siteID': this.getID() });
      this.setUsers(users.result);
      return users.result;
    }
  }

  async getUser(userID) {
    const users = await UserStorage.getUsers(this.getTenantID(), { 'siteID': this.getID(), 'userID': userID });
    if (users.count > 0) {
      return users.result[0];
    }
    return null;
  }

  removeUser(user) {
    if (this._model.users) {
      for (let i = 0; i < this._model.users.length; i++) {
        if (this._model.users[i].id === user.getID()) {
          this._model.users.splice(i, 1);
          break;
        }
      }
    }
  }

  setUsers(users) {
    this._model.users = users.map((user) => user.getModel());
  }

  static checkIfSiteValid(filteredRequest, req) {
    // Update model?
    if (req.method !== 'POST' && !filteredRequest.id) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `Site ID is mandatory`, Constants.HTTP_GENERAL_ERROR,
        'Site', 'checkIfSiteValid',
        req.user.id);
    }
    if (!filteredRequest.name) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `Site Name is mandatory`, Constants.HTTP_GENERAL_ERROR,
        'Site', 'checkIfSiteValid',
        req.user.id, filteredRequest.id);
    }
    if (!filteredRequest.companyID) {
      throw new AppError(
        Constants.CENTRAL_SERVER,
        `Company ID is mandatory for the Site`, Constants.HTTP_GENERAL_ERROR,
        'Sites', 'checkIfSiteValid',
        req.user.id, filteredRequest.id);
    }
  }

  static getSite(tenantID, id) {
    return SiteStorage.getSite(tenantID, id);
  }

  static getSites(tenantID, params, limit?, skip?, sort?) {
    return SiteStorage.getSites(tenantID, params, limit, skip, sort);
  }

  static getSiteImage(tenantID, id) {
    return SiteStorage.getSiteImage(tenantID, id);
  }

  static addUsersToSite(tenantID, id, userIDs) {
    return SiteStorage.addUsersToSite(tenantID, id, userIDs);
  }

  static removeUsersFromSite(tenantID, id, userIDs) {
    return SiteStorage.removeUsersFromSite(tenantID, id, userIDs);
  }
}
*/
