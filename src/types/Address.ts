export default interface Address {
    address1: string;
    adress2?: string;
    postalCode: string;
    city: string;
    department?: string;
    region?: string;
    country: string;
    latitude: number;
    longitude: number;
}