#!/usr/bin/env node

const fs = require('fs');
const http = require('http');
const https = require('https');

const tenantID = '5be7fb271014d90008992f06'
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjVjNGYwM2Y5MjMwNmJkZTcxNTdlZmRkZiIsInJvbGUiOiJBIiwicm9sZXNBQ0wiOlsiYWRtaW4iXSwibmFtZSI6IkJFTk9JVCIsIm1vYmlsZSI6IiIsImVtYWlsIjoiamVyb21lLmJlbm9pdEBzYXAuY29tIiwidGFnSURzIjpbIjg0RkIyQTQ0IiwiQkoxMDE2NTI0NTA1IiwiNUNENTBFMDIiXSwiZmlyc3ROYW1lIjoiSsOpcsO0bWUiLCJsb2NhbGUiOiJlbl9VUyIsImxhbmd1YWdlIjoiZW4iLCJjdXJyZW5jeSI6IkVVUiIsInRlbmFudElEIjoiNWJlN2ZiMjcxMDE0ZDkwMDA4OTkyZjA2IiwidGVuYW50TmFtZSI6IlNBUCBMYWJzIEZyYW5jZSAtIENoYXJnZUBXb3JrIiwidGVuYW50U3ViZG9tYWluIjoic2xmIiwidXNlckhhc2hJRCI6IjkwZDA0MTlmYmNkODQ3MWIwZDA4NmJiODAyOWU2YjE0NGM0ZjIwMzcwZjE0ZTc5ZTBkMTgzZTU0OWQ3MzI4N2QiLCJ0ZW5hbnRIYXNoSUQiOiI4YTRmYWZjOTdhNWNiY2JmZWMwMjdkYjQ1NTVkNTBkZTc4MWZkMDE1Zjc4NDJmMjYxNmUwNjI5NjczNDNkNDJkIiwic2NvcGVzIjpbIkFzc2V0OkNoZWNrQ29ubmVjdGlvbiIsIkFzc2V0OkNyZWF0ZSIsIkFzc2V0OkRlbGV0ZSIsIkFzc2V0OlJlYWQiLCJBc3NldDpSZXRyaWV2ZUNvbnN1bXB0aW9uIiwiQXNzZXQ6VXBkYXRlIiwiQXNzZXRzOkluRXJyb3IiLCJBc3NldHM6TGlzdCIsIkJpbGxpbmc6Q2hlY2tDb25uZWN0aW9uIiwiQ2FyOkNyZWF0ZSIsIkNhcjpEZWxldGUiLCJDYXI6UmVhZCIsIkNhcjpVcGRhdGUiLCJDYXJDYXRhbG9nOlJlYWQiLCJDYXJDYXRhbG9nczpMaXN0IiwiQ2FyczpMaXN0IiwiQ2hhcmdpbmdQcm9maWxlOlJlYWQiLCJDaGFyZ2luZ1Byb2ZpbGVzOkxpc3QiLCJDaGFyZ2luZ1N0YXRpb246QXV0aG9yaXplIiwiQ2hhcmdpbmdTdGF0aW9uOkNoYW5nZUF2YWlsYWJpbGl0eSIsIkNoYXJnaW5nU3RhdGlvbjpDaGFuZ2VDb25maWd1cmF0aW9uIiwiQ2hhcmdpbmdTdGF0aW9uOkNsZWFyQ2FjaGUiLCJDaGFyZ2luZ1N0YXRpb246Q2xlYXJDaGFyZ2luZ1Byb2ZpbGUiLCJDaGFyZ2luZ1N0YXRpb246Q3JlYXRlIiwiQ2hhcmdpbmdTdGF0aW9uOkRlbGV0ZSIsIkNoYXJnaW5nU3RhdGlvbjpFeHBvcnQiLCJDaGFyZ2luZ1N0YXRpb246R2V0Q29tcG9zaXRlU2NoZWR1bGUiLCJDaGFyZ2luZ1N0YXRpb246R2V0Q29uZmlndXJhdGlvbiIsIkNoYXJnaW5nU3RhdGlvbjpHZXREaWFnbm9zdGljcyIsIkNoYXJnaW5nU3RhdGlvbjpSZWFkIiwiQ2hhcmdpbmdTdGF0aW9uOlJlbW90ZVN0YXJ0VHJhbnNhY3Rpb24iLCJDaGFyZ2luZ1N0YXRpb246UmVtb3RlU3RvcFRyYW5zYWN0aW9uIiwiQ2hhcmdpbmdTdGF0aW9uOlJlc2V0IiwiQ2hhcmdpbmdTdGF0aW9uOlNldENoYXJnaW5nUHJvZmlsZSIsIkNoYXJnaW5nU3RhdGlvbjpTdGFydFRyYW5zYWN0aW9uIiwiQ2hhcmdpbmdTdGF0aW9uOlN0b3BUcmFuc2FjdGlvbiIsIkNoYXJnaW5nU3RhdGlvbjpVbmxvY2tDb25uZWN0b3IiLCJDaGFyZ2luZ1N0YXRpb246VXBkYXRlIiwiQ2hhcmdpbmdTdGF0aW9uOlVwZGF0ZUZpcm13YXJlIiwiQ2hhcmdpbmdTdGF0aW9uczpJbkVycm9yIiwiQ2hhcmdpbmdTdGF0aW9uczpMaXN0IiwiQ29tcGFuaWVzOkxpc3QiLCJDb21wYW55OkNyZWF0ZSIsIkNvbXBhbnk6RGVsZXRlIiwiQ29tcGFueTpSZWFkIiwiQ29tcGFueTpVcGRhdGUiLCJDb25uZWN0aW9uOkNyZWF0ZSIsIkNvbm5lY3Rpb246RGVsZXRlIiwiQ29ubmVjdGlvbjpSZWFkIiwiQ29ubmVjdGlvbnM6TGlzdCIsIkludm9pY2U6RG93bmxvYWQiLCJJbnZvaWNlczpMaXN0IiwiTG9nZ2luZzpSZWFkIiwiTG9nZ2luZ3M6TGlzdCIsIk5vdGlmaWNhdGlvbjpDcmVhdGUiLCJPY3BpRW5kcG9pbnQ6Q3JlYXRlIiwiT2NwaUVuZHBvaW50OkRlbGV0ZSIsIk9jcGlFbmRwb2ludDpHZW5lcmF0ZUxvY2FsVG9rZW4iLCJPY3BpRW5kcG9pbnQ6UGluZyIsIk9jcGlFbmRwb2ludDpSZWFkIiwiT2NwaUVuZHBvaW50OlJlZ2lzdGVyIiwiT2NwaUVuZHBvaW50OlRyaWdnZXJKb2IiLCJPY3BpRW5kcG9pbnQ6VXBkYXRlIiwiT2NwaUVuZHBvaW50czpMaXN0IiwiT2ljcEVuZHBvaW50OkNyZWF0ZSIsIk9pY3BFbmRwb2ludDpEZWxldGUiLCJPaWNwRW5kcG9pbnQ6UGluZyIsIk9pY3BFbmRwb2ludDpSZWFkIiwiT2ljcEVuZHBvaW50OlJlZ2lzdGVyIiwiT2ljcEVuZHBvaW50OlRyaWdnZXJKb2IiLCJPaWNwRW5kcG9pbnQ6VXBkYXRlIiwiT2ljcEVuZHBvaW50czpMaXN0IiwiUGF5bWVudE1ldGhvZDpDcmVhdGUiLCJQYXltZW50TWV0aG9kOkRlbGV0ZSIsIlBheW1lbnRNZXRob2Q6UmVhZCIsIlBheW1lbnRNZXRob2RzOkxpc3QiLCJQcmljaW5nOlJlYWQiLCJQcmljaW5nOlVwZGF0ZSIsIlJlcG9ydDpSZWFkIiwiU2V0dGluZzpDcmVhdGUiLCJTZXR0aW5nOkRlbGV0ZSIsIlNldHRpbmc6UmVhZCIsIlNldHRpbmc6VXBkYXRlIiwiU2V0dGluZ3M6TGlzdCIsIlNpdGU6Q3JlYXRlIiwiU2l0ZTpEZWxldGUiLCJTaXRlOlJlYWQiLCJTaXRlOlVwZGF0ZSIsIlNpdGVBcmVhOkNyZWF0ZSIsIlNpdGVBcmVhOkRlbGV0ZSIsIlNpdGVBcmVhOlJlYWQiLCJTaXRlQXJlYTpVcGRhdGUiLCJTaXRlQXJlYXM6TGlzdCIsIlNpdGVzOkxpc3QiLCJUYWc6Q3JlYXRlIiwiVGFnOkRlbGV0ZSIsIlRhZzpSZWFkIiwiVGFnOlVwZGF0ZSIsIlRhZ3M6SW1wb3J0IiwiVGFnczpMaXN0IiwiVGF4ZXM6TGlzdCIsIlRva2VuOkNyZWF0ZSIsIlRva2VuOkRlbGV0ZSIsIlRva2VuOlJlYWQiLCJUb2tlbjpVcGRhdGUiLCJUb2tlbnM6TGlzdCIsIlRyYW5zYWN0aW9uOkRlbGV0ZSIsIlRyYW5zYWN0aW9uOlJlYWQiLCJUcmFuc2FjdGlvbjpSZWZ1bmRUcmFuc2FjdGlvbiIsIlRyYW5zYWN0aW9uOlVwZGF0ZSIsIlRyYW5zYWN0aW9uczpFeHBvcnQiLCJUcmFuc2FjdGlvbnM6SW5FcnJvciIsIlRyYW5zYWN0aW9uczpMaXN0IiwiVXNlcjpDcmVhdGUiLCJVc2VyOkRlbGV0ZSIsIlVzZXI6UmVhZCIsIlVzZXI6U3luY2hyb25pemVCaWxsaW5nVXNlciIsIlVzZXI6VXBkYXRlIiwiVXNlcnM6RXhwb3J0IiwiVXNlcnM6SW1wb3J0IiwiVXNlcnM6SW5FcnJvciIsIlVzZXJzOkxpc3QiLCJVc2VyczpTeW5jaHJvbml6ZUJpbGxpbmdVc2VycyIsIlVzZXJzQ2FyczpBc3NpZ24iLCJVc2Vyc0NhcnM6TGlzdCIsIlVzZXJzU2l0ZXM6QXNzaWduIiwiVXNlcnNTaXRlczpMaXN0IiwiVXNlcnNTaXRlczpVbmFzc2lnbiJdLCJzaXRlc0FkbWluIjpbXSwic2l0ZXNPd25lciI6W10sInNpdGVzIjpbXSwiYWN0aXZlQ29tcG9uZW50cyI6WyJvY3BpIiwicHJpY2luZyIsIm9yZ2FuaXphdGlvbiIsInN0YXRpc3RpY3MiLCJhbmFseXRpY3MiLCJhc3NldCIsInNtYXJ0Q2hhcmdpbmciLCJjYXIiXSwiaWF0IjoxNjIwMTE2MjgxLCJleHAiOjE2MjAxNTk0ODF9.DrSoOKZunyuUSgx2mZJXt_tBXLsMXTMoiy73IlAuG6E'
const hostRestApi = 'localhost';
const portRestApi = '8090';
const httpsClient = false;
const httpClient = httpsClient ? https : http;
const switchEndpointPathURI = `/v1/api/ccp/switch`;
const getEndpointPathURI = `/v1/api/ccp`;

const poolTypeArray = ['Gireve', 'Vedecom', 'Elaad', 'Hubject'];

const args = process.argv.slice(2);
const cmd = args[0];

let ccpType;

switch (cmd) {
  case 'switch':
    ccpType = args[1];
    switchCcp(ccpType);
    break;
  case 'get':
    getCcp();
    break;
  default:
    console.log(`Usage: - ./CertificatesPool.js switch <ccpType>
       - ./CertificatesPool.js get`);
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

function switchCcp(ccpType) {
  if (!ccpType) {
    console.error('Contract Certificate Pool type CLI argument not provided');
    return;
  }
  if (!poolTypeArray.includes(ccpType)) {
    console.error('Invalid Contract Certificate Pool type CLI argument provided');
    return;
  }
  const requestOptions = {
    host: `${hostRestApi}`,
    port: `${portRestApi}`,
    path: `${switchEndpointPathURI}`,
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Tenant': tenantID,
      'Authorization': `Bearer ${token}`
    }
  };
  const httpRequest = httpClient.request(requestOptions, requestCallback);
  httpRequest.write(JSON.stringify({
    ccpType: ccpType,
  }));
  httpRequest.end();
}

function getCcp() {
  const requestOptions = {
    host: `${hostRestApi}`,
    port: `${portRestApi}`,
    path: `${getEndpointPathURI}`,
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Tenant': tenantID,
      'Authorization': `Bearer ${token}`
    }
  };
  const httpRequest = httpClient.request(requestOptions, requestCallback);
  httpRequest.end();
}

