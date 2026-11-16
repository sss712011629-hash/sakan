/* Background push for «نظافة السكن» (Firebase Cloud Messaging). */
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");
const cfg = JSON.parse(new URL(self.location).searchParams.get("cfg") || "{}");
firebase.initializeApp(cfg);
const messaging = firebase.messaging();
messaging.onBackgroundMessage(p => {
  const n = p.notification || {}, d = p.data || {};
  self.registration.showNotification(n.title || d.title || "نظافة السكن", {
    body: n.body || d.body || "", icon: "icons/icon-192.png", badge: "icons/icon-192.png",
    dir: "rtl", lang: "ar", tag: d.tag || "sakan", data: { link: d.link || "./" }
  });
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then(ws => {
    for (const w of ws) if ("focus" in w) return w.focus();
    return clients.openWindow((e.notification.data && e.notification.data.link) || "./");
  }));
});
