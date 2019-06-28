import Site from "./Site";

export default interface SiteUser {
  site: Site;
  userID: string;
  siteAdmin: boolean;
}
