cd "/home/serge/Documents/evse/ev-dashboard"
npm run build:prod
rm -r "/home/serge/Documents/evse/ev-server/dist/front-end"
cp -R "./dist" "/home/serge/Documents/evse/ev-server/dist/front-end"
