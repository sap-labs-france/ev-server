rm -R ./export
mkdir export
mongoimport --uri $MONGO_URI --collection companies --file /export/companies.json
mongoimport --uri $MONGO_URI --collection companylogos --file /export/companylogos.json
mongoimport --uri $MONGO_URI --collection sites --file /export/sites.json
mongoimport --uri $MONGO_URI --collection siteusers --file /export/siteusers.json
mongoimport --uri $MONGO_URI --collection siteimages --file /export/siteimages.json
mongoimport --uri $MONGO_URI --collection siteareas --file /export/siteareas.json
mongoimport --uri $MONGO_URI --collection siteareaimages --file /export/siteareaimages.json
mongoimport --uri $MONGO_URI --collection authorizes --file /export/authorizes.json
mongoimport --uri $MONGO_URI --collection bootnotifications --file /export/bootnotifications.json
mongoimport --uri $MONGO_URI --collection chargingstations --file /export/chargingstations.json
mongoimport --uri $MONGO_URI --collection configurations --file /export/configurations.json
mongoimport --uri $MONGO_URI --collection datatransfers --file /export/datatransfers.json
mongoimport --uri $MONGO_URI --collection metervalues --file /export/metervalues.json
mongoimport --uri $MONGO_URI --collection migrations --file /export/migrations.json
mongoimport --uri $MONGO_URI --collection eulas --file /export/eulas.json
mongoimport --uri $MONGO_URI --collection notifications --file /export/notifications.json
mongoimport --uri $MONGO_URI --collection pricings --file /export/pricings.json
mongoimport --uri $MONGO_URI --collection statusnotifications --file /export/statusnotifications.json
mongoimport --uri $MONGO_URI --collection tags --file /export/tags.json
mongoimport --uri $MONGO_URI --collection transactions --file /export/transactions.json
mongoimport --uri $MONGO_URI --collection users --file /export/users.json
mongoimport --uri $MONGO_URI --collection userimages --file /export/userimages.json
mongoimport --uri $MONGO_URI --collection vehiclemanufacturers --file /export/vehiclemanufacturers.json
mongoimport --uri $MONGO_URI --collection vehiclemanufacturerlogos --file /export/vehiclemanufacturerlogos.json
mongoimport --uri $MONGO_URI --collection vehicles --file /export/vehicles.json
mongoimport --uri $MONGO_URI --collection vehicleimages --file /export/vehicleimages.json
