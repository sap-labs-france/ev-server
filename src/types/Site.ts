import CreatedUpdatedProps from "./CreatedUpdatedProps";
import ChargingStation from "../entity/ChargingStation";
import Address from "./Address";
import SiteArea from "./SiteArea";
import Company from "./Company";
import User from "../entity/User";

export default interface Site extends CreatedUpdatedProps {

    id: string;
    name: string;
    address: Address;
    companyID: string;
    allowAllUsersToStopTransactions: boolean;
    autoUserSiteAssignment: boolean;
    image?: string;
    availableChargers?: number;
    totalChargers?: number;
    availableConnectors?: number;
    totalConnectors?: number;
    siteAreas?: SiteArea;
    company?: Company;


  // static checkIfSiteValid(filteredRequest, req) {
  //   // Update model?
  //   if (req.method !== 'POST' && !filteredRequest.id) {
  //     throw new AppError(
  //       Constants.CENTRAL_SERVER,
  //       `Site ID is mandatory`, 500,
  //       'Site', 'checkIfSiteValid',
  //       req.user.id);
  //   }
  //   if (!filteredRequest.name) {
  //     throw new AppError(
  //       Constants.CENTRAL_SERVER,
  //       `Site Name is mandatory`, 500,
  //       'Site', 'checkIfSiteValid',
  //       req.user.id, filteredRequest.id);
  //   }
  //   if (!filteredRequest.companyID) {
  //     throw new AppError(
  //       Constants.CENTRAL_SERVER,
  //       `Company ID is mandatory for the Site`, 500,
  //       'Sites', 'checkIfSiteValid',
  //       req.user.id, filteredRequest.id);
  //   }
  // }
}
