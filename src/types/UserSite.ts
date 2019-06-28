import User from "../entity/User";

export default interface SiteUser {
  user: User;
  siteID: string;
  siteAdmin: boolean;
}
