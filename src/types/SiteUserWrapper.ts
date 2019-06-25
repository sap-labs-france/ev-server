import Site from "./Site";
import User from "../entity/User";

export default interface SiteUserWrapper {
    siteAdmin: boolean;
    siteID: string;
    user: User;
}