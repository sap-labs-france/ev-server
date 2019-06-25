import Constants from "../../utils/Constants";
import HttpDatabaseRequest from "./HttpDatabaseRequest";

export interface HttpSiteUserAssignmentRequest {
    siteID: string;
    userIDs: string[];
    role: string;
}

export interface HttpSiteUserRoleChangeRequest {
    siteAdmin: boolean;
    userID: string;
    siteID: string;
}

export interface HttpSiteRequest extends HttpDatabaseRequest {
    ID: string;
}

export interface HttpSitesRequest extends HttpDatabaseRequest {
    WithAvailableChargers: boolean;
    WithCompany: boolean;
    UserID: string;
    CompanyID: string;
    ExcludeSitesOfUserID: boolean;
    Search: string;
}