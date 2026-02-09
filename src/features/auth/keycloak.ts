import Keycloak from 'keycloak-js';

const ssoUrl = (import.meta as any)?.env?.VITE_SSO_URL as string | undefined;
const ssoRealm = (import.meta as any)?.env?.VITE_SSO_REALM as string | undefined;
const ssoClientId = (import.meta as any)?.env?.VITE_SSO_CLIENT_ID as string | undefined;

// Note: Keycloak-js is a public client library and doesn't use client_secret directly
// The client_secret (7dfb8f12-0f91-4650-afef-e58f6da31393) should be configured server-side
// For PKCE flow (used here), client_secret is not needed on the frontend

export const keycloak =
  ssoUrl && ssoRealm && ssoClientId
    ? new Keycloak({
        url: ssoUrl,
        realm: ssoRealm,
        clientId: ssoClientId,
      })
    : null;

export type KeycloakLike = NonNullable<typeof keycloak>;


