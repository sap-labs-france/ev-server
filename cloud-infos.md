# Charge-Angels - Cloud

## Common

### NIGINX
#### Logs
- /var/log/nginx/access.log
- /var/log/nginx/error.log

#### SSL
- /etc/pki/nginx/bundle.cer
- /etc/pki/nginx/82.165.163.132.key

## Namespace 'cloud'
### Angular  
- /var/www/html/cloud

### NodeJs
#### Servers
- Server: /var/www/nodejs/cloud   50000
- Chargers: /var/www/nodejs/cloud   58000
- Start Server: pm2 start pm2-env.json (avec le user evse)
- Save for server restart: pm2 startup ->

#### Logs
- /home/evse/.pm2/logs/cloud-out-0.log
- /home/evse/.pm2/logs/cloud-error-0.log

### MongoDB
#### Server
- /var/lib/mongodb/cloud      32500

#### Config
- /etc/mongod_cloud.conf

#### Logs
- /var/log/mongodb/cloud/mongod.log

#### Service
- /lib/systemd/system/mongod_cloud.service
- sudo service mongod_cloud status
- sudo service mongod_cloud start
- sudo service mongod_cloud stop
