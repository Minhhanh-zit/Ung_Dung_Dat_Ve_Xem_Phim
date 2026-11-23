#!/usr/bin/env node
'use strict';
// Read-only anonymous access checks. Safe for an isolated RUNNING local backend.
// No credential, no POST/PATCH/DELETE, no SQL mutation or real payments.
const base = (process.env.CINEHUNT_API_URL || 'http://127.0.0.1:3000').replace(/\/+$/, '');
const routes = [
  '/auth/me',
  '/bookings/admin/all',
  '/showtimes/admin/all',
  '/payments/booking/1',
];
async function run() {
  let fails = 0;
  for (const route of routes) {
    try {
      const res = await fetch(base + route, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        redirect: 'manual',
        signal: AbortSignal.timeout(10000),
      });
      if (res.status === 401 || res.status === 403) {
        console.log('PASS anonymous GET ' + route + ' => HTTP ' + res.status);
      } else {
        fails++;
        console.error('FAIL anonymous GET ' + route + ' => HTTP ' + res.status + ' (expected 401/403)');
      }
    } catch (error) {
      fails++;
      console.error('FAIL anonymous GET ' + route + ': ' + (error.message || String(error)));
    }
  }
  console.log('ANON_READONLY_CHECKS=' + (routes.length - fails) + '/' + routes.length);
  if (fails) process.exitCode = 1;
}
run().catch(err => {
  console.error('ANON_READONLY_TEST_FAILED=' + (err.message || String(err)));
  process.exitCode = 1;
});
