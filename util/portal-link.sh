#!/bin/bash
# chmod 755 portal-link.sh
#  
# Use this way
# $ ./portal-link.sh
# Host (format http://foo.com ): https://keycloak.example.com
# Username: <your-username>
# Password:
# orgId: <org-id>
# baseUri (e.g. http://localhost:9000/auth ): http://localhost:9000/auth
# 
# baseUri is passed explicitly because the wizard may be served from a different base path
# 
# orgId is the ID of an organization in the realm (this script targets the realm named "cloud")
# the Username and Password are the ones you use to log into the wizard
# the result of that script will return a json object with a link field that will contain the link to automagically log you in and redirect you to the wizard


read -p 'Host (format http://foo.com ): ' host
read -p 'Username: ' user
read -sp 'Password: ' pass

DIRECT_GRANT_RESPONSE=$(curl -i --request POST $host/auth/realms/cloud/protocol/openid-connect/token --header "Accept: application/json" --header "Content-Type: application/x-www-form-urlencoded" --data "grant_type=password&username=$user&password=$pass&client_id=admin-cli")
ACCESS_TOKEN=$(echo $DIRECT_GRANT_RESPONSE | grep "access_token" | sed 's/.*\"access_token\":\"\([^\"]*\)\".*/\1/g');

read -p 'orgId: ' orgid
read -p 'baseUri (e.g. http://localhost:9000/auth ): ' baseUri

curl --request POST $host/auth/realms/cloud/orgs/$orgid/portal-link --header "Accept: application/json" --header "Authorization: Bearer $ACCESS_TOKEN" --data-urlencode "baseUri=$baseUri"