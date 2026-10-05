/**
 * Central application branding — driven by environment so renaming the
 * product never requires a code change.
 *
 * Set in .env / .env.local (and your deployment host):
 *   NEXT_PUBLIC_APP_NAME="Afri Connect"
 *   NEXT_PUBLIC_APP_TAGLINE="Zambia Energy Market"
 *
 * NEXT_PUBLIC_* values are inlined at build time — after changing them,
 * restart the dev server / rebuild for the new name to appear.
 */

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'Afri Connect';
export const APP_TAGLINE = process.env.NEXT_PUBLIC_APP_TAGLINE || 'Zambia Energy Market';

/** Email "From" display name — server-side only usage. */
export const APP_NAME_SERVER = process.env.APP_NAME || APP_NAME;
