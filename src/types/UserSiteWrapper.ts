import Site from "./Site";

export default interface UserSiteWrapper {
    siteAdmin: boolean;
    userID: string;
    site: Site;
}