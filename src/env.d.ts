/// <reference types="astro/client" />
declare namespace App {
  interface Locals {
    lang: import('./lib/i18n').Lang;
    t: import('./i18n/fr').Dict;
    user: import('./server/db').UserRow | null;
    session: import('./server/db').SessionRow | null;
    theme: 'dark' | 'light';
  }
}
