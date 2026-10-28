if (location.pathname === '/admin-demo' || location.pathname.startsWith('/admin-demo/')) {
  import('./admin.js');
} else if (location.pathname === '/admin' || location.pathname.startsWith('/admin/')) {
  import('./live-admin.js');
} else {
  import('./home.js');
}
