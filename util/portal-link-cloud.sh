#!/bin/bash
# Prompts for:
#   host     e.g. https://keycloak.example.com
#   realm    e.g. <your-realm>
#   username / password of a user who can create portal links for the org
#   orgId    the organization ID
#   baseUri  e.g. http://localhost:9000/auth

read -p 'Host (format http://foo.com ): ' host
read -p 'Realm: ' realm
read -p 'Username: ' user
read -sp 'Password: ' pass

DIRECT_GRANT_RESPONSE=$(curl -i --request POST $host/auth/realms/$realm/protocol/openid-connect/token --header "Accept: application/json" --header "Content-Type: application/x-www-form-urlencoded" --data "grant_type=password&username=$user&password=$pass&client_id=admin-cli")
ACCESS_TOKEN=$(echo $DIRECT_GRANT_RESPONSE | grep "access_token" | sed 's/.*\"access_token\":\"\([^\"]*\)\".*/\1/g');

read -p 'orgId: ' orgid
read -p 'baseUri (e.g. http://localhost:9000/auth ): ' baseUri

curl --request POST $host/auth/realms/$realm/orgs/$orgid/portal-link --header "Accept: application/json" --header "Authorization: Bearer $ACCESS_TOKEN" --data-urlencode "baseUri=$baseUri"