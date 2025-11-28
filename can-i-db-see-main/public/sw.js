self.addEventListener('push', function(event) {
  var data = {};
  try { data = event.data ? event.data.json() : {}; } catch {}
  var title = data.title || 'Notification';
  var body = data.body || '';
  var url = data.url || '/';
  var options = { body: body, data: { url: url } };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function(event) {
  var url = event.notification && event.notification.data && event.notification.data.url ? event.notification.data.url : '/';
  event.notification.close();
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list) {
    for (var i = 0; i < list.length; i++) {
      var client = list[i];
      if (client.url && client.url.indexOf(url) !== -1) { return client.focus(); }
    }
    return clients.openWindow(url);
  }));
});