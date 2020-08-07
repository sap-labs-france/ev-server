import Address from './Address';
import CreatedUpdatedProps from './CreatedUpdatedProps';

export default interface Tenant extends CreatedUpdatedProps {
  id: string;
  name: string;
  email: string;
  subdomain: string;
  address: Address;
  logo: string;
  components: {
    ocpi?: {
      active: boolean;
      type: string;
    };
    organization?: {
      active: boolean;
    };
    pricing?: {
      active: boolean;
      type: string;
    };
    billing?: {
      active: boolean;
      type: string;
    };
    refund?: {
      active: boolean;
      type: string;
    };
    statistics?: {
      active: boolean;
      type: string;
    };
    analytics?: {
      active: boolean;
      type: string;
    };
    smartCharging?: {
      active: boolean;
      type: string;
    };
    asset?: {
      active: boolean;
      type: string;
    };
    car?: {
      active: boolean;
      type: string;
    };
  };
}
