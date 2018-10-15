#!/usr/bin/env bash
rm -rf export
mkdir export
mongoexport --uri $MONGO_URI --collection companies --out /export/companies.json
mongoexport --uri $MONGO_URI  --collection companylogos --out /export/companylogos.json
mongoexport --uri $MONGO_URI  --collection sites --out /export/sites.json
mongoexport --uri $MONGO_URI  --collection siteusers --out /export/siteusers.json
mongoexport --uri $MONGO_URI  --collection siteimages --out /export/siteimages.json
mongoexport --uri $MONGO_URI  --collection siteareas --out /export/siteareas.json
mongoexport --uri $MONGO_URI  --collection siteareaimages --out /export/siteareaimages.json
mongoexport --uri $MONGO_URI  --collection authorizes --out /export/authorizes.json
mongoexport --uri $MONGO_URI  --collection bootnotifications --out /export/bootnotifications.json
mongoexport --uri $MONGO_URI  --collection chargingstations --out /export/chargingstations.json
mongoexport --uri $MONGO_URI  --collection configurations --out /export/configurations.json
mongoexport --uri $MONGO_URI  --collection datatransfers --out /export/datatransfers.json
mongoexport --uri $MONGO_URI  --collection metervalues --out /export/metervalues.json
mongoexport --uri $MONGO_URI  --collection migrations --out /export/migrations.json
mongoexport --uri $MONGO_URI  --collection eulas --out /export/eulas.json
mongoexport --uri $MONGO_URI  --collection notifications --out /export/notifications.json
mongoexport --uri $MONGO_URI  --collection pricings --out /export/pricings.json
mongoexport --uri $MONGO_URI  --collection statusnotifications --out /export/statusnotifications.json
mongoexport --uri $MONGO_URI  --collection tags --out /export/tags.json
mongoexport --uri $MONGO_URI  --collection transactions --out /export/transactions.json
mongoexport --uri $MONGO_URI  --collection users --out /export/users.json
mongoexport --uri $MONGO_URI  --collection userimages --out /export/userimages.json
mongoexport --uri $MONGO_URI  --collection vehiclemanufacturers --out /export/vehiclemanufacturers.json
mongoexport --uri $MONGO_URI  --collection vehiclemanufacturerlogos --out /export/vehiclemanufacturerlogos.json
mongoexport --uri $MONGO_URI  --collection vehicles --out /export/vehicles.json
mongoexport --uri $MONGO_URI  --collection vehicleimages --out /export/vehicleimages.json
