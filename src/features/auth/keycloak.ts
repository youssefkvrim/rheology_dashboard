import Keycloak from 'keycloak-js';

const ssoUrl = (import.meta as any)?.env?.VITE_SSO_URL as string | undefined;
const ssoRealm = (import.meta as any)?.env?.VITE_SSO_REALM as string | undefined;
const ssoClientId = (import.meta as any)?.env?.VITE_SSO_CLIENT_ID as string | undefined;

export const keycloak =
  ssoUrl && ssoRealm && ssoClientId
    ? new Keycloak({
        url: ssoUrl,
        realm: ssoRealm,
        clientId: ssoClientId,
      })
    : null;

export type KeycloakLike = NonNullable<typeof keycloak>;


