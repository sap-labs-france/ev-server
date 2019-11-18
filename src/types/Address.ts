export default interface Address {
  address1: string;
  address2?: string;
  postalCode: string;
  city: string;
  department?: string;
  region?: string;
  country: string;
  coordinates: number[];
}
