#!/usr/bin/env node

const fs = require('fs');
const http = require('http');
const https = require('https');
const { X509Certificate } = require('@peculiar/x509');

const tenantID = '5be7fb271014d90008992f06'
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjVjNGYwM2Y5MjMwNmJkZTcxNTdlZmRkZiIsInJvbGUiOiJBIiwibmFtZSI6IkJFTk9JVCIsIm1vYmlsZSI6IiIsImVtYWlsIjoiamVyb21lLmJlbm9pdEBzYXAuY29tIiwidGFnSURzIjpbIkJKMTAxNjUyNDUwNSJdLCJmaXJzdE5hbWUiOiJKw6lyw7RtZSIsImxvY2FsZSI6ImZyX0ZSIiwibGFuZ3VhZ2UiOiJmciIsImN1cnJlbmN5IjoiRVVSIiwidGVuYW50SUQiOiI1YmU3ZmIyNzEwMTRkOTAwMDg5OTJmMDYiLCJ0ZW5hbnROYW1lIjoiU0FQIExhYnMgRnJhbmNlIiwidGVuYW50U3ViZG9tYWluIjoic2xmIiwidXNlckhhc2hJRCI6IjRhODJmMDA4NGMyNDYyNGViNWNjMGZlMjE5MmNjNDMxMWIwNmFiZjllNmMxYWFiZWI1OTBmNDQxZTc3NjFmOTMiLCJ0ZW5hbnRIYXNoSUQiOiI4NjcwMGQ4YjJkYmRjYzQ5OTUwZGQ1NGVmYTY5NjU4NTNmN2YzZmU5ZDUzMGRlZTg2N2M3NzdkZWM2NTdhZDljIiwic2NvcGVzIjpbIkFzc2V0OkNoZWNrQ29ubmVjdGlvbiIsIkFzc2V0OkNyZWF0ZSIsIkFzc2V0OkRlbGV0ZSIsIkFzc2V0OlJlYWQiLCJBc3NldDpSZXRyaWV2ZUNvbnN1bXB0aW9uIiwiQXNzZXQ6VXBkYXRlIiwiQXNzZXRzOkluRXJyb3IiLCJBc3NldHM6TGlzdCIsIkJpbGxpbmc6Q2hlY2tDb25uZWN0aW9uIiwiQ2FyOkNyZWF0ZSIsIkNhcjpEZWxldGUiLCJDYXI6UmVhZCIsIkNhcjpVcGRhdGUiLCJDYXJDYXRhbG9nOlJlYWQiLCJDYXJDYXRhbG9nczpMaXN0IiwiQ2FyczpMaXN0IiwiQ2hhcmdpbmdQcm9maWxlOlJlYWQiLCJDaGFyZ2luZ1Byb2ZpbGVzOkxpc3QiLCJDaGFyZ2luZ1N0YXRpb246QXV0aG9yaXplIiwiQ2hhcmdpbmdTdGF0aW9uOkNoYW5nZUF2YWlsYWJpbGl0eSIsIkNoYXJnaW5nU3RhdGlvbjpDaGFuZ2VDb25maWd1cmF0aW9uIiwiQ2hhcmdpbmdTdGF0aW9uOkNsZWFyQ2FjaGUiLCJDaGFyZ2luZ1N0YXRpb246Q2xlYXJDaGFyZ2luZ1Byb2ZpbGUiLCJDaGFyZ2luZ1N0YXRpb246Q3JlYXRlIiwiQ2hhcmdpbmdTdGF0aW9uOkRlbGV0ZSIsIkNoYXJnaW5nU3RhdGlvbjpEZWxldGVDZXJ0aWZpY2F0ZSIsIkNoYXJnaW5nU3RhdGlvbjpFeHBvcnQiLCJDaGFyZ2luZ1N0YXRpb246R2V0Q29tcG9zaXRlU2NoZWR1bGUiLCJDaGFyZ2luZ1N0YXRpb246R2V0Q29uZmlndXJhdGlvbiIsIkNoYXJnaW5nU3RhdGlvbjpHZXREaWFnbm9zdGljcyIsIkNoYXJnaW5nU3RhdGlvbjpHZXRJbnN0YWxsZWRDZXJ0aWZpY2F0ZUlkcyIsIkNoYXJnaW5nU3RhdGlvbjpJbnN0YWxsQ2VydGlmaWNhdGUiLCJDaGFyZ2luZ1N0YXRpb246UmVhZCIsIkNoYXJnaW5nU3RhdGlvbjpSZW1vdGVTdGFydFRyYW5zYWN0aW9uIiwiQ2hhcmdpbmdTdGF0aW9uOlJlbW90ZVN0b3BUcmFuc2FjdGlvbiIsIkNoYXJnaW5nU3RhdGlvbjpSZXNldCIsIkNoYXJnaW5nU3RhdGlvbjpTZXRDaGFyZ2luZ1Byb2ZpbGUiLCJDaGFyZ2luZ1N0YXRpb246U3RhcnRUcmFuc2FjdGlvbiIsIkNoYXJnaW5nU3RhdGlvbjpTdG9wVHJhbnNhY3Rpb24iLCJDaGFyZ2luZ1N0YXRpb246VW5sb2NrQ29ubmVjdG9yIiwiQ2hhcmdpbmdTdGF0aW9uOlVwZGF0ZSIsIkNoYXJnaW5nU3RhdGlvbjpVcGRhdGVGaXJtd2FyZSIsIkNoYXJnaW5nU3RhdGlvbnM6SW5FcnJvciIsIkNoYXJnaW5nU3RhdGlvbnM6TGlzdCIsIkNvbXBhbmllczpMaXN0IiwiQ29tcGFueTpDcmVhdGUiLCJDb21wYW55OkRlbGV0ZSIsIkNvbXBhbnk6UmVhZCIsIkNvbXBhbnk6VXBkYXRlIiwiQ29ubmVjdGlvbjpDcmVhdGUiLCJDb25uZWN0aW9uOkRlbGV0ZSIsIkNvbm5lY3Rpb246UmVhZCIsIkNvbm5lY3Rpb25zOkxpc3QiLCJJbnZvaWNlOkNyZWF0ZSIsIkludm9pY2U6RG93bmxvYWQiLCJJbnZvaWNlczpMaXN0IiwiSW52b2ljZXM6U3luY2hyb25pemUiLCJMb2dnaW5nOlJlYWQiLCJMb2dnaW5nczpMaXN0IiwiTm90aWZpY2F0aW9uOkNyZWF0ZSIsIk9jcGlFbmRwb2ludDpDcmVhdGUiLCJPY3BpRW5kcG9pbnQ6RGVsZXRlIiwiT2NwaUVuZHBvaW50OkdlbmVyYXRlTG9jYWxUb2tlbiIsIk9jcGlFbmRwb2ludDpQaW5nIiwiT2NwaUVuZHBvaW50OlJlYWQiLCJPY3BpRW5kcG9pbnQ6UmVnaXN0ZXIiLCJPY3BpRW5kcG9pbnQ6VHJpZ2dlckpvYiIsIk9jcGlFbmRwb2ludDpVcGRhdGUiLCJPY3BpRW5kcG9pbnRzOkxpc3QiLCJPaWNwRW5kcG9pbnQ6Q3JlYXRlIiwiT2ljcEVuZHBvaW50OkRlbGV0ZSIsIk9pY3BFbmRwb2ludDpQaW5nIiwiT2ljcEVuZHBvaW50OlJlYWQiLCJPaWNwRW5kcG9pbnQ6UmVnaXN0ZXIiLCJPaWNwRW5kcG9pbnQ6VHJpZ2dlckpvYiIsIk9pY3BFbmRwb2ludDpVcGRhdGUiLCJPaWNwRW5kcG9pbnRzOkxpc3QiLCJQYXltZW50TWV0aG9kOkNyZWF0ZSIsIlBheW1lbnRNZXRob2Q6RGVsZXRlIiwiUGF5bWVudE1ldGhvZDpSZWFkIiwiUGF5bWVudE1ldGhvZHM6TGlzdCIsIlByaWNpbmc6UmVhZCIsIlByaWNpbmc6VXBkYXRlIiwiUmVwb3J0OlJlYWQiLCJTZXR0aW5nOkNyZWF0ZSIsIlNldHRpbmc6RGVsZXRlIiwiU2V0dGluZzpSZWFkIiwiU2V0dGluZzpVcGRhdGUiLCJTZXR0aW5nczpMaXN0IiwiU2l0ZTpDcmVhdGUiLCJTaXRlOkRlbGV0ZSIsIlNpdGU6UmVhZCIsIlNpdGU6VXBkYXRlIiwiU2l0ZUFyZWE6Q3JlYXRlIiwiU2l0ZUFyZWE6RGVsZXRlIiwiU2l0ZUFyZWE6UmVhZCIsIlNpdGVBcmVhOlVwZGF0ZSIsIlNpdGVBcmVhczpMaXN0IiwiU2l0ZXM6TGlzdCIsIlRhZzpDcmVhdGUiLCJUYWc6RGVsZXRlIiwiVGFnOlJlYWQiLCJUYWc6VXBkYXRlIiwiVGFnczpMaXN0IiwiVGF4ZXM6TGlzdCIsIlRva2VuOkNyZWF0ZSIsIlRva2VuOkRlbGV0ZSIsIlRva2VuOlJlYWQiLCJUb2tlbjpVcGRhdGUiLCJUb2tlbnM6TGlzdCIsIlRyYW5zYWN0aW9uOkRlbGV0ZSIsIlRyYW5zYWN0aW9uOlJlYWQiLCJUcmFuc2FjdGlvbjpSZWZ1bmRUcmFuc2FjdGlvbiIsIlRyYW5zYWN0aW9uOlVwZGF0ZSIsIlRyYW5zYWN0aW9uczpFeHBvcnQiLCJUcmFuc2FjdGlvbnM6SW5FcnJvciIsIlRyYW5zYWN0aW9uczpMaXN0IiwiVXNlcjpDcmVhdGUiLCJVc2VyOkRlbGV0ZSIsIlVzZXI6UmVhZCIsIlVzZXI6U3luY2hyb25pemVCaWxsaW5nVXNlciIsIlVzZXI6VXBkYXRlIiwiVXNlcnM6RXhwb3J0IiwiVXNlcnM6SW1wb3J0IiwiVXNlcnM6SW5FcnJvciIsIlVzZXJzOkxpc3QiLCJVc2VyczpTeW5jaHJvbml6ZUJpbGxpbmdVc2VycyIsIlVzZXJzQ2FyczpBc3NpZ24iLCJVc2Vyc0NhcnM6TGlzdCIsIlVzZXJzU2l0ZXM6QXNzaWduIiwiVXNlcnNTaXRlczpMaXN0IiwiVXNlcnNTaXRlczpVbmFzc2lnbiJdLCJzaXRlc0FkbWluIjpbXSwic2l0ZXNPd25lciI6W10sInNpdGVzIjpbXSwiYWN0aXZlQ29tcG9uZW50cyI6WyJvY3BpIiwib3JnYW5pemF0aW9uIiwicHJpY2luZyIsImFuYWx5dGljcyJdLCJpYXQiOjE2MTY2MDQzOTYsImV4cCI6MTYxNjY0NzU5Nn0.eYQikmTeTnKxG_jbPg8sh3B-BHrSwVsqL1ehq29deFs';
const hostRestApi = 'localhost';
const portRestApi = '8090';
const httpsClient = false;
const httpClient = httpsClient ? https : http;
const pushEndpointPathURI = `/v1/api/charging-stations/:id/certificates/install`;
const deleteEndpointPathURI = `/v1/api/charging-stations/:id/certificates/delete`;
const pullEndpointPathURI = `/v1/api/charging-stations/:id/certificates`;

const args = process.argv.slice(2);
const cmd = args[0];

const certificateTypeArray = ['V2GRootCertificate', 'MORootCertificate', 'CSOSubCA1', 'CSOSubCA2', 'CSMSRootCertificate', 'ManufacturerRootCertificate'];

let certificateFile;
let certificateType;
let chargingStationId;

switch (cmd) {
  case 'put':
    certificateFile = args[1];
    certificateType = args[2];
    chargingStationId = args[3];
    pushCertificateFile(certificateFile, certificateType, chargingStationId);
    break;
  case 'get':
    certificateFile = args[1];
    chargingStationId = args[2];
    pullCertificateIds(certificateFile, chargingStationId);
    break;
  case 'delete':
    console.info('Not yet implemented client side');
    break;
  default:
    console.log(`Usage: - ./Certificates.js put <certificateFile> <certificateType> <chargingStationId>
       - ./Certificates.js get <certificateType> <chargingStationId>`
    );
}

function requestCallback(response) {
  var str = '';
  response.on('data', function (chunk) {
    str += chunk;
  });

  response.on('end', function () {
    console.log(str);
    if (response.statusCode != 200) {
      console.error('API call failed with response code ' + response.statusCode);
    }
  });
}

function pushCertificateFile(certificateFile, certificateType, chargingStationId) {
  if (!certificateFile) {
    console.error('Certificate file CLI argument not provided');
  } else if (fs.existsSync(certificateFile)) {
    if (!certificateTypeArray.includes(certificateType)) {
      console.error('Invalid certificate type CLI argument provided ' + certificateType);
      return;
    }
    if (!chargingStationId) {
      console.error('Charging station id CLI argument not provided');
      return;
    }
    const x509Certificate = new X509Certificate(fs.readFileSync(certificateFile));
    const requestOptions = {
      host: `${hostRestApi}`,
      port: `${portRestApi}`,
      path: `${pushEndpointPathURI.replace(':id', chargingStationId)}`,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Tenant': tenantID,
        'Authorization': `Bearer ${token}`
      }
    };
    const httpRequest = httpClient.request(requestOptions, requestCallback);
    httpRequest.write(JSON.stringify({
      chargingStationID: chargingStationId,
      args: {
        certificateType: certificateType,
        certificate: x509Certificate.toString('hex')
      }
    }));
    httpRequest.end();
  } else {
    console.error(`Certificate file '${certificateFile}' does not exist`);
  }
}

function pullCertificateIds(certificateType, chargingStationId) {
  if (!certificateTypeArray.includes(certificateType)) {
    console.error('Invalid certificate type CLI argument provided ' + certificateType);
    return;
  }
  if (!chargingStationId) {
    console.error('Charging station id CLI argument not provided');
    return;
  }
  const requestOptions = {
    host: `${hostRestApi}`,
    port: `${portRestApi}`,
    path: `${pullEndpointPathURI.replace(':id', chargingStationId)}`,
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Tenant': tenantID,
      'Authorization': `Bearer ${token}`
    }
  };
  const httpRequest = httpClient.request(requestOptions, requestCallback);
  httpRequest.write(JSON.stringify({
    chargingStationID: chargingStationId,
    args: {
      typeOfCertificate: certificateType
    }
  }));
  httpRequest.end();
}
