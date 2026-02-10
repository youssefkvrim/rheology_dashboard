// keycloak is the SSO login thing the company uses
import Keycloak from 'keycloak-js';

// all these come from env vars - if they're not set, SSO is off (dev mode)
const ssoUrl = (import.meta as any)?.env?.VITE_SSO_URL as string | undefined;
const ssoRealm = (import.meta as any)?.env?.VITE_SSO_REALM as string | undefined;
const ssoClientId = (import.meta as any)?.env?.VITE_SSO_CLIENT_ID as string | undefined;

// only creates the keycloak client if all the SSO config is there, otherwise its just null
export const keycloak =
  ssoUrl && ssoRealm && ssoClientId
    ? new Keycloak({
        url: ssoUrl,
        realm: ssoRealm,
        clientId: ssoClientId,
      })
    : null;

// helper type so u can use this without null checks when u know SSO is on
export type KeycloakLike = NonNullable<typeof keycloak>;


