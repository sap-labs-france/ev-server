import User from './User';

export default interface UserToken {
  id?: string;
  role?: string;
  rolesACL?: string[];
  name?: string;
  email?: string;
  mobile?: string;
  firstName?: string;
  locale?: string;
  language?: string;
  currency?: string;
  tagIDs?: string[];
  tenantID: string;
  tenantSubdomain?: string;
  tenantName?: string;
  userHashID?: string;
  tenantHashID?: string;
  scopes?: string[];
  companies?: string[];
  sites?: string[];
  sitesAdmin?: string[];
  sitesOwner?: string[];
  activeComponents?: string[];
  user?: User;
  technical?: boolean;
}
