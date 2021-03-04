#!/usr/bin/env node

const fs = require('fs');
const http = require('http');
const https = require('https');
const { X509Certificate } = require("@peculiar/x509");

const tenantID = '5be7fb271014d90008992f06'
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjVjNGYwM2Y5MjMwNmJkZTcxNTdlZmRkZiIsInJvbGUiOiJBIiwibmFtZSI6IkJFTk9JVCIsIm1vYmlsZSI6IiIsImVtYWlsIjoiamVyb21lLmJlbm9pdEBzYXAuY29tIiwidGFnSURzIjpbIk1BMDAwMDEiLCJGNjYzOTNCMyIsIkJKMTAxNjUyNDUwNSIsIjVDRDUwRTAyIl0sImZpcnN0TmFtZSI6IkrDqXLDtG1lIiwibG9jYWxlIjoiZnJfRlIiLCJsYW5ndWFnZSI6ImZyIiwiY3VycmVuY3kiOiJFVVIiLCJ0ZW5hbnRJRCI6IjViZTdmYjI3MTAxNGQ5MDAwODk5MmYwNiIsInRlbmFudE5hbWUiOiJTQVAgTGFicyBGcmFuY2UgLSBDaGFyZ2VAV29yayIsInRlbmFudFN1YmRvbWFpbiI6InNsZiIsInVzZXJIYXNoSUQiOiI0YTgyZjAwODRjMjQ2MjRlYjVjYzBmZTIxOTJjYzQzMTFiMDZhYmY5ZTZjMWFhYmViNTkwZjQ0MWU3NzYxZjkzIiwidGVuYW50SGFzaElEIjoiMmJiMmVkMmQ0OTliMmQ5OWEzODZmNjNhNmMwNTkzZmZiOTA1MTVmM2UwOWQyYzY0NTAwMjdlMzA3N2FjNzlhYSIsInNjb3BlcyI6WyJBc3NldDpDaGVja0Nvbm5lY3Rpb24iLCJBc3NldDpDcmVhdGUiLCJBc3NldDpEZWxldGUiLCJBc3NldDpSZWFkIiwiQXNzZXQ6UmV0cmlldmVDb25zdW1wdGlvbiIsIkFzc2V0OlVwZGF0ZSIsIkFzc2V0czpJbkVycm9yIiwiQXNzZXRzOkxpc3QiLCJCaWxsaW5nOkNoZWNrQ29ubmVjdGlvbiIsIkNhcjpDcmVhdGUiLCJDYXI6RGVsZXRlIiwiQ2FyOlJlYWQiLCJDYXI6VXBkYXRlIiwiQ2FyQ2F0YWxvZzpSZWFkIiwiQ2FyQ2F0YWxvZ3M6TGlzdCIsIkNhcnM6TGlzdCIsIkNoYXJnaW5nUHJvZmlsZTpSZWFkIiwiQ2hhcmdpbmdQcm9maWxlczpMaXN0IiwiQ2hhcmdpbmdTdGF0aW9uOkF1dGhvcml6ZSIsIkNoYXJnaW5nU3RhdGlvbjpDaGFuZ2VBdmFpbGFiaWxpdHkiLCJDaGFyZ2luZ1N0YXRpb246Q2hhbmdlQ29uZmlndXJhdGlvbiIsIkNoYXJnaW5nU3RhdGlvbjpDbGVhckNhY2hlIiwiQ2hhcmdpbmdTdGF0aW9uOkNsZWFyQ2hhcmdpbmdQcm9maWxlIiwiQ2hhcmdpbmdTdGF0aW9uOkNyZWF0ZSIsIkNoYXJnaW5nU3RhdGlvbjpEZWxldGUiLCJDaGFyZ2luZ1N0YXRpb246RXhwb3J0IiwiQ2hhcmdpbmdTdGF0aW9uOkdldENvbXBvc2l0ZVNjaGVkdWxlIiwiQ2hhcmdpbmdTdGF0aW9uOkdldENvbmZpZ3VyYXRpb24iLCJDaGFyZ2luZ1N0YXRpb246R2V0RGlhZ25vc3RpY3MiLCJDaGFyZ2luZ1N0YXRpb246UmVhZCIsIkNoYXJnaW5nU3RhdGlvbjpSZW1vdGVTdGFydFRyYW5zYWN0aW9uIiwiQ2hhcmdpbmdTdGF0aW9uOlJlbW90ZVN0b3BUcmFuc2FjdGlvbiIsIkNoYXJnaW5nU3RhdGlvbjpSZXNldCIsIkNoYXJnaW5nU3RhdGlvbjpTZXRDaGFyZ2luZ1Byb2ZpbGUiLCJDaGFyZ2luZ1N0YXRpb246U3RhcnRUcmFuc2FjdGlvbiIsIkNoYXJnaW5nU3RhdGlvbjpTdG9wVHJhbnNhY3Rpb24iLCJDaGFyZ2luZ1N0YXRpb246VW5sb2NrQ29ubmVjdG9yIiwiQ2hhcmdpbmdTdGF0aW9uOlVwZGF0ZSIsIkNoYXJnaW5nU3RhdGlvbjpVcGRhdGVGaXJtd2FyZSIsIkNoYXJnaW5nU3RhdGlvbnM6SW5FcnJvciIsIkNoYXJnaW5nU3RhdGlvbnM6TGlzdCIsIkNvbXBhbmllczpMaXN0IiwiQ29tcGFueTpDcmVhdGUiLCJDb21wYW55OkRlbGV0ZSIsIkNvbXBhbnk6UmVhZCIsIkNvbXBhbnk6VXBkYXRlIiwiQ29ubmVjdGlvbjpDcmVhdGUiLCJDb25uZWN0aW9uOkRlbGV0ZSIsIkNvbm5lY3Rpb246UmVhZCIsIkNvbm5lY3Rpb25zOkxpc3QiLCJJbnZvaWNlOkNyZWF0ZSIsIkludm9pY2U6RG93bmxvYWQiLCJJbnZvaWNlczpMaXN0IiwiSW52b2ljZXM6U3luY2hyb25pemUiLCJMb2dnaW5nOlJlYWQiLCJMb2dnaW5nczpMaXN0IiwiTm90aWZpY2F0aW9uOkNyZWF0ZSIsIk9jcGlFbmRwb2ludDpDcmVhdGUiLCJPY3BpRW5kcG9pbnQ6RGVsZXRlIiwiT2NwaUVuZHBvaW50OkdlbmVyYXRlTG9jYWxUb2tlbiIsIk9jcGlFbmRwb2ludDpQaW5nIiwiT2NwaUVuZHBvaW50OlJlYWQiLCJPY3BpRW5kcG9pbnQ6UmVnaXN0ZXIiLCJPY3BpRW5kcG9pbnQ6VHJpZ2dlckpvYiIsIk9jcGlFbmRwb2ludDpVcGRhdGUiLCJPY3BpRW5kcG9pbnRzOkxpc3QiLCJQcmljaW5nOlJlYWQiLCJQcmljaW5nOlVwZGF0ZSIsIlJlcG9ydDpSZWFkIiwiU2V0dGluZzpDcmVhdGUiLCJTZXR0aW5nOkRlbGV0ZSIsIlNldHRpbmc6UmVhZCIsIlNldHRpbmc6VXBkYXRlIiwiU2V0dGluZ3M6TGlzdCIsIlNpdGU6Q3JlYXRlIiwiU2l0ZTpEZWxldGUiLCJTaXRlOlJlYWQiLCJTaXRlOlVwZGF0ZSIsIlNpdGVBcmVhOkNyZWF0ZSIsIlNpdGVBcmVhOkRlbGV0ZSIsIlNpdGVBcmVhOlJlYWQiLCJTaXRlQXJlYTpVcGRhdGUiLCJTaXRlQXJlYXM6TGlzdCIsIlNpdGVzOkxpc3QiLCJUYWc6Q3JlYXRlIiwiVGFnOkRlbGV0ZSIsIlRhZzpSZWFkIiwiVGFnOlVwZGF0ZSIsIlRhZ3M6TGlzdCIsIlRheGVzOkxpc3QiLCJUb2tlbjpDcmVhdGUiLCJUb2tlbjpEZWxldGUiLCJUb2tlbjpSZWFkIiwiVG9rZW46VXBkYXRlIiwiVG9rZW5zOkxpc3QiLCJUcmFuc2FjdGlvbjpEZWxldGUiLCJUcmFuc2FjdGlvbjpSZWFkIiwiVHJhbnNhY3Rpb246UmVmdW5kVHJhbnNhY3Rpb24iLCJUcmFuc2FjdGlvbjpVcGRhdGUiLCJUcmFuc2FjdGlvbnM6RXhwb3J0IiwiVHJhbnNhY3Rpb25zOkluRXJyb3IiLCJUcmFuc2FjdGlvbnM6TGlzdCIsIlVzZXI6Q3JlYXRlIiwiVXNlcjpEZWxldGUiLCJVc2VyOlJlYWQiLCJVc2VyOlN5bmNocm9uaXplQmlsbGluZ1VzZXIiLCJVc2VyOlVwZGF0ZSIsIlVzZXJzOkV4cG9ydCIsIlVzZXJzOkltcG9ydCIsIlVzZXJzOkluRXJyb3IiLCJVc2VyczpMaXN0IiwiVXNlcnM6U3luY2hyb25pemVCaWxsaW5nVXNlcnMiLCJVc2Vyc0NhcnM6QXNzaWduIiwiVXNlcnNDYXJzOkxpc3QiLCJVc2Vyc1NpdGVzOkFzc2lnbiIsIlVzZXJzU2l0ZXM6TGlzdCIsIlVzZXJzU2l0ZXM6VW5hc3NpZ24iXSwiY29tcGFuaWVzIjpbXSwic2l0ZXNBZG1pbiI6W10sInNpdGVzT3duZXIiOltdLCJzaXRlcyI6W10sImFjdGl2ZUNvbXBvbmVudHMiOlsib2NwaSIsInByaWNpbmciLCJvcmdhbml6YXRpb24iLCJzdGF0aXN0aWNzIiwiYW5hbHl0aWNzIiwic21hcnRDaGFyZ2luZyIsImNhciJdLCJpYXQiOjE2MTQ4MDQzMDUsImV4cCI6MTYxNDg0NzUwNX0.IWoEGQ9humY-UlP1O0-DZfOpZpGD7Rn_Waq_XXnIJy0';
const hostRestApi = 'localhost';
const portRestApi = '8090'
const endpointPathURI = `/v1/api/chargingstations/certificate/install`;

const args = process.argv.slice(2);
const cmd = args[0];
const certificateFile = args[1];
const certificateType = args[2]
const chargeBoxId = args[3];

const certificateTypeArray = ['V2GRootCertificate', 'MORootCertificate', 'CSOSubCA1', 'CSOSubCA2', 'CSMSRootCertificate', 'ManufacturerRootCertificate']

requestCallback = function (response) {
  var str = ''
  response.on('data', function (chunk) {
    str += chunk;
  });

  response.on('end', function () {
    console.log(str);
    if (response.statusCode != 200) {
      console.error("API call failed with response code " + response.statusCode);
    }
  });
}

function putCertificateFile(certificateFile) {
  if (!certificateFile) {
    console.error('Certificate file CLI argument not provided');
  } else if (fs.existsSync(certificateFile)) {
    if (!chargeBoxId) {
      console.log('Charge box id CLI argument not provided');
      return;
    }
    if (!certificateTypeArray.includes(certificateType)) {
      console.log('Invalid certificate type CLI argument provided ' + certificateType);
      return;
    }
    const x509 = new X509Certificate(fs.readFileSync(certificateFile));
    const requestOptions = {
      host: `${hostRestApi}`,
      port: `${portRestApi}`,
      path: `${endpointPathURI}`,
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
        certificate: x509
      }
    }));
    httpRequest.end();
  } else {
    console.error(`Certificate file '${certificateFile}' does not exist`);
  }
}

switch (cmd) {
  case 'put':
    putCertificateFile(certificateFile);
    break;
  default:
    console.log(`Usage: - ./InstallCertificate.js put <certificateFile> <certificateType> <chargeBoxId>`)
}
