// Push notification service worker

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: 'PDO Kanban', body: event.data.text() };
  }

  const titles = {
    new_ticket: 'New Ticket',
    assigned: 'Ticket Assigned',
    comment: 'New Comment',
    status: 'Status Update',
  };

  const title = titles[data.type] || 'PDO Kanban';
  const options = {
    body: data.body || data.title || '',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    tag: data.type + '-' + (data.ticketNumber || ''),
    data: {
      ticketNumber: data.ticketNumber,
      url: '/board?ticket=PDO-' + data.ticketNumber,
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/board';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Focus existing window if available
      for (const client of windowClients) {
        if (client.url.includes('/board') && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Open new window
      return clients.openWindow(url);
    })
  );
});
