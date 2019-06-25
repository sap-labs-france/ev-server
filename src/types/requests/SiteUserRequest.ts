import Constants from "../../utils/Constants";

export default interface SiteUserRequest {
    siteID: string;
    userIDs: string[];
    role: string;
}