export default interface FirebaseConfiguration {
  type: string;
  projectID: string;
  privateKeyID: string;
  privateKey: string;
  clientEmail: string;
  clientID: string;
  authURI: string;
  tokenURI: string;
  authProviderX509CertURL: string;
  clientX509CertURL: string;
  databaseURL: string;
}
