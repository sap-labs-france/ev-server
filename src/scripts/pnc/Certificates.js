#!/usr/bin/env node

const fs = require('fs');
const http = require('http');
const https = require('https');
const { X509Certificate } = require('@peculiar/x509');

const tenantID = '5be7fb271014d90008992f06'
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjVjNGYwM2Y5MjMwNmJkZTcxNTdlZmRkZiIsInJvbGUiOiJBIiwibmFtZSI6IkJFTk9JVCIsIm1vYmlsZSI6IiIsImVtYWlsIjoiamVyb21lLmJlbm9pdEBzYXAuY29tIiwidGFnSURzIjpbIk1BMDAwMDEiLCJGNjYzOTNCMyIsIkJKMTAxNjUyNDUwNSIsIjVDRDUwRTAyIl0sImZpcnN0TmFtZSI6IkrDqXLDtG1lIiwibG9jYWxlIjoiZnJfRlIiLCJsYW5ndWFnZSI6ImZyIiwiY3VycmVuY3kiOiJFVVIiLCJ0ZW5hbnRJRCI6IjViZTdmYjI3MTAxNGQ5MDAwODk5MmYwNiIsInRlbmFudE5hbWUiOiJTQVAgTGFicyBGcmFuY2UgLSBDaGFyZ2VAV29yayIsInRlbmFudFN1YmRvbWFpbiI6InNsZiIsInVzZXJIYXNoSUQiOiI0YTgyZjAwODRjMjQ2MjRlYjVjYzBmZTIxOTJjYzQzMTFiMDZhYmY5ZTZjMWFhYmViNTkwZjQ0MWU3NzYxZjkzIiwidGVuYW50SGFzaElEIjoiMmJiMmVkMmQ0OTliMmQ5OWEzODZmNjNhNmMwNTkzZmZiOTA1MTVmM2UwOWQyYzY0NTAwMjdlMzA3N2FjNzlhYSIsInNjb3BlcyI6WyJBc3NldDpDaGVja0Nvbm5lY3Rpb24iLCJBc3NldDpDcmVhdGUiLCJBc3NldDpEZWxldGUiLCJBc3NldDpSZWFkIiwiQXNzZXQ6UmV0cmlldmVDb25zdW1wdGlvbiIsIkFzc2V0OlVwZGF0ZSIsIkFzc2V0czpJbkVycm9yIiwiQXNzZXRzOkxpc3QiLCJCaWxsaW5nOkNoZWNrQ29ubmVjdGlvbiIsIkNhcjpDcmVhdGUiLCJDYXI6RGVsZXRlIiwiQ2FyOlJlYWQiLCJDYXI6VXBkYXRlIiwiQ2FyQ2F0YWxvZzpSZWFkIiwiQ2FyQ2F0YWxvZ3M6TGlzdCIsIkNhcnM6TGlzdCIsIkNoYXJnaW5nUHJvZmlsZTpSZWFkIiwiQ2hhcmdpbmdQcm9maWxlczpMaXN0IiwiQ2hhcmdpbmdTdGF0aW9uOkF1dGhvcml6ZSIsIkNoYXJnaW5nU3RhdGlvbjpDaGFuZ2VBdmFpbGFiaWxpdHkiLCJDaGFyZ2luZ1N0YXRpb246Q2hhbmdlQ29uZmlndXJhdGlvbiIsIkNoYXJnaW5nU3RhdGlvbjpDbGVhckNhY2hlIiwiQ2hhcmdpbmdTdGF0aW9uOkNsZWFyQ2hhcmdpbmdQcm9maWxlIiwiQ2hhcmdpbmdTdGF0aW9uOkNyZWF0ZSIsIkNoYXJnaW5nU3RhdGlvbjpEZWxldGUiLCJDaGFyZ2luZ1N0YXRpb246RGVsZXRlQ2VydGlmaWNhdGUiLCJDaGFyZ2luZ1N0YXRpb246RXhwb3J0IiwiQ2hhcmdpbmdTdGF0aW9uOkdldENvbXBvc2l0ZVNjaGVkdWxlIiwiQ2hhcmdpbmdTdGF0aW9uOkdldENvbmZpZ3VyYXRpb24iLCJDaGFyZ2luZ1N0YXRpb246R2V0RGlhZ25vc3RpY3MiLCJDaGFyZ2luZ1N0YXRpb246R2V0SW5zdGFsbGVkQ2VydGlmaWNhdGVJZHMiLCJDaGFyZ2luZ1N0YXRpb246SW5zdGFsbENlcnRpZmljYXRlIiwiQ2hhcmdpbmdTdGF0aW9uOlJlYWQiLCJDaGFyZ2luZ1N0YXRpb246UmVtb3RlU3RhcnRUcmFuc2FjdGlvbiIsIkNoYXJnaW5nU3RhdGlvbjpSZW1vdGVTdG9wVHJhbnNhY3Rpb24iLCJDaGFyZ2luZ1N0YXRpb246UmVzZXQiLCJDaGFyZ2luZ1N0YXRpb246U2V0Q2hhcmdpbmdQcm9maWxlIiwiQ2hhcmdpbmdTdGF0aW9uOlN0YXJ0VHJhbnNhY3Rpb24iLCJDaGFyZ2luZ1N0YXRpb246U3RvcFRyYW5zYWN0aW9uIiwiQ2hhcmdpbmdTdGF0aW9uOlVubG9ja0Nvbm5lY3RvciIsIkNoYXJnaW5nU3RhdGlvbjpVcGRhdGUiLCJDaGFyZ2luZ1N0YXRpb246VXBkYXRlRmlybXdhcmUiLCJDaGFyZ2luZ1N0YXRpb25zOkluRXJyb3IiLCJDaGFyZ2luZ1N0YXRpb25zOkxpc3QiLCJDb21wYW5pZXM6TGlzdCIsIkNvbXBhbnk6Q3JlYXRlIiwiQ29tcGFueTpEZWxldGUiLCJDb21wYW55OlJlYWQiLCJDb21wYW55OlVwZGF0ZSIsIkNvbm5lY3Rpb246Q3JlYXRlIiwiQ29ubmVjdGlvbjpEZWxldGUiLCJDb25uZWN0aW9uOlJlYWQiLCJDb25uZWN0aW9uczpMaXN0IiwiSW52b2ljZTpDcmVhdGUiLCJJbnZvaWNlOkRvd25sb2FkIiwiSW52b2ljZXM6TGlzdCIsIkludm9pY2VzOlN5bmNocm9uaXplIiwiTG9nZ2luZzpSZWFkIiwiTG9nZ2luZ3M6TGlzdCIsIk5vdGlmaWNhdGlvbjpDcmVhdGUiLCJPY3BpRW5kcG9pbnQ6Q3JlYXRlIiwiT2NwaUVuZHBvaW50OkRlbGV0ZSIsIk9jcGlFbmRwb2ludDpHZW5lcmF0ZUxvY2FsVG9rZW4iLCJPY3BpRW5kcG9pbnQ6UGluZyIsIk9jcGlFbmRwb2ludDpSZWFkIiwiT2NwaUVuZHBvaW50OlJlZ2lzdGVyIiwiT2NwaUVuZHBvaW50OlRyaWdnZXJKb2IiLCJPY3BpRW5kcG9pbnQ6VXBkYXRlIiwiT2NwaUVuZHBvaW50czpMaXN0IiwiUHJpY2luZzpSZWFkIiwiUHJpY2luZzpVcGRhdGUiLCJSZXBvcnQ6UmVhZCIsIlNldHRpbmc6Q3JlYXRlIiwiU2V0dGluZzpEZWxldGUiLCJTZXR0aW5nOlJlYWQiLCJTZXR0aW5nOlVwZGF0ZSIsIlNldHRpbmdzOkxpc3QiLCJTaXRlOkNyZWF0ZSIsIlNpdGU6RGVsZXRlIiwiU2l0ZTpSZWFkIiwiU2l0ZTpVcGRhdGUiLCJTaXRlQXJlYTpDcmVhdGUiLCJTaXRlQXJlYTpEZWxldGUiLCJTaXRlQXJlYTpSZWFkIiwiU2l0ZUFyZWE6VXBkYXRlIiwiU2l0ZUFyZWFzOkxpc3QiLCJTaXRlczpMaXN0IiwiVGFnOkNyZWF0ZSIsIlRhZzpEZWxldGUiLCJUYWc6UmVhZCIsIlRhZzpVcGRhdGUiLCJUYWdzOkxpc3QiLCJUYXhlczpMaXN0IiwiVG9rZW46Q3JlYXRlIiwiVG9rZW46RGVsZXRlIiwiVG9rZW46UmVhZCIsIlRva2VuOlVwZGF0ZSIsIlRva2VuczpMaXN0IiwiVHJhbnNhY3Rpb246RGVsZXRlIiwiVHJhbnNhY3Rpb246UmVhZCIsIlRyYW5zYWN0aW9uOlJlZnVuZFRyYW5zYWN0aW9uIiwiVHJhbnNhY3Rpb246VXBkYXRlIiwiVHJhbnNhY3Rpb25zOkV4cG9ydCIsIlRyYW5zYWN0aW9uczpJbkVycm9yIiwiVHJhbnNhY3Rpb25zOkxpc3QiLCJVc2VyOkNyZWF0ZSIsIlVzZXI6RGVsZXRlIiwiVXNlcjpSZWFkIiwiVXNlcjpTeW5jaHJvbml6ZUJpbGxpbmdVc2VyIiwiVXNlcjpVcGRhdGUiLCJVc2VyczpFeHBvcnQiLCJVc2VyczpJbXBvcnQiLCJVc2VyczpJbkVycm9yIiwiVXNlcnM6TGlzdCIsIlVzZXJzOlN5bmNocm9uaXplQmlsbGluZ1VzZXJzIiwiVXNlcnNDYXJzOkFzc2lnbiIsIlVzZXJzQ2FyczpMaXN0IiwiVXNlcnNTaXRlczpBc3NpZ24iLCJVc2Vyc1NpdGVzOkxpc3QiLCJVc2Vyc1NpdGVzOlVuYXNzaWduIl0sImNvbXBhbmllcyI6W10sInNpdGVzQWRtaW4iOltdLCJzaXRlc093bmVyIjpbXSwic2l0ZXMiOltdLCJhY3RpdmVDb21wb25lbnRzIjpbIm9jcGkiLCJwcmljaW5nIiwib3JnYW5pemF0aW9uIiwic3RhdGlzdGljcyIsImFuYWx5dGljcyIsInNtYXJ0Q2hhcmdpbmciLCJjYXIiXSwiaWF0IjoxNjE0ODg1NDk3LCJleHAiOjE2MTQ5Mjg2OTd9.z526Pbze_YqR-TkmLjZ-dpJnUx6l1_D0fa-PyWpdAR0';
const hostRestApi = 'localhost';
const portRestApi = '8090'
const pushEndpointPathURI = `/v1/api/chargingstations/:id/certificates/install`;
const deleteEndpointPathURI = `/v1/api/chargingstations/:id/certificates/delete`;
const pullEndpointPathURI = `/v1/api/chargingstations/:id/certificates`;

const args = process.argv.slice(2);
const cmd = args[0];

const certificateTypeArray = ['V2GRootCertificate', 'MORootCertificate', 'CSOSubCA1', 'CSOSubCA2', 'CSMSRootCertificate', 'ManufacturerRootCertificate'];

let certificateFile;
let certificateType;
let chargeBoxId;

switch (cmd) {
  case 'put':
    certificateFile = args[1];
    certificateType = args[2];
    chargeBoxId = args[3];
    pushCertificateFile(certificateFile, certificateType, chargeBoxId);
    break;
  case 'get':
    certificateFile = args[1];
    chargeBoxId = args[2];
    pullCertificateIds(certificateFile, chargeBoxId);
    break;
  case 'delete':
    console.info('Not yet implemented client side');
    break;
  default:
    console.log(`Usage: - ./InstallCertificate.js put <certificateFile> <certificateType> <chargeBoxId>
       - ./InstallCertificate.js get <certificateType> <chargeBoxId>`
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

function pushCertificateFile(certificateFile, certificateType, chargeBoxId) {
  if (!certificateFile) {
    console.error('Certificate file CLI argument not provided');
  } else if (fs.existsSync(certificateFile)) {
    if (!certificateTypeArray.includes(certificateType)) {
      console.error('Invalid certificate type CLI argument provided ' + certificateType);
      return;
    }
    if (!chargeBoxId) {
      console.error('Charge box id CLI argument not provided');
      return;
    }
    const x509Certificate = new X509Certificate(fs.readFileSync(certificateFile));
    const requestOptions = {
      host: `${hostRestApi}`,
      port: `${portRestApi}`,
      path: `${pushEndpointPathURI.replace(':id', chargeBoxId)}`,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Tenant': tenantID,
        'Authorization': `Bearer ${token}`
      }
    };
    const httpRequest = http.request(requestOptions, requestCallback);
    httpRequest.write(JSON.stringify({
      chargeBoxID: chargeBoxId,
      args: {
        certificateType: certificateType,
        certificate: x509Certificate.toString('pem')
      }
    }));
    httpRequest.end();
  } else {
    console.error(`Certificate file '${certificateFile}' does not exist`);
  }
}

function pullCertificateIds(certificateType, chargeBoxId) {
  if (!certificateTypeArray.includes(certificateType)) {
    console.error('Invalid certificate type CLI argument provided ' + certificateType);
    return;
  }
  if (!chargeBoxId) {
    console.error('Charge box id CLI argument not provided');
    return;
  }
  const requestOptions = {
    host: `${hostRestApi}`,
    port: `${portRestApi}`,
    path: `${pullEndpointPathURI.replace(':id', chargeBoxId)}`,
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Tenant': tenantID,
      'Authorization': `Bearer ${token}`
    }
  };
  const httpRequest = http.request(requestOptions, requestCallback);
  httpRequest.write(JSON.stringify({
    chargeBoxID: chargeBoxId,
    args: {
      typeOfCertificate: certificateType
    }
  }));
  httpRequest.end();
}
