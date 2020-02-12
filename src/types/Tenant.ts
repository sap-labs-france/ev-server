import CreatedUpdatedProps from './CreatedUpdatedProps';

export default interface Tenant extends CreatedUpdatedProps {
  id: string;
  name: string;
  email: string;
  subdomain: string;
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
    building?: {
      active: boolean;
      type: string;
    };
  };
}
