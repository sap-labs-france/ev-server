import CreatedUpdatedProps from "./CreatedUpdatedProps";

export default interface Tenant extends CreatedUpdatedProps {
  id: string;
  name: string;
  email: string;
  subdomain: string;
  components: any[];

}
