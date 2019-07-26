import CreatedUpdatedProps from "./CreatedUpdatedProps";

export default interface Tenant extends CreatedUpdatedProps {
  id: string;
  name: string;
  email: string;
  subdomain: string;
  components: {
    ocpi?: {
      active: boolean,
      type: any
    },
    organization?: {
      active: boolean
    },
    pricing?: {
      active: boolean,
      type: string
    },
    refund?: {
      active: boolean,
      type: string
    },
    analytics?: {
      active: boolean,
      type: string
    }
  };
  _eMI3?: any;

}
