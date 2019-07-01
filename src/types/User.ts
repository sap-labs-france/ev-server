import User from "../entity/User";

export default interface UserSite {
  user: User;
  siteID: string;
  siteAdmin: boolean;
}
