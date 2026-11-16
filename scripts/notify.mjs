// Sends the house's push notifications. Run by GitHub Actions.
// MODE=morning  -> 9:00 Riyadh: "today it's X's turn" to everyone (+ a personal one to X)
// MODE=check    -> every 15 min: when today's cleaning is marked done, tell everyone once
// MODE=evening  -> 21:00 Riyadh: if not done yet, remind everyone
import admin from "firebase-admin";
const sa = JSON.parse(process.env.FIREBASE_SA);
const HOUSE = process.env.HOUSE_ID;
const MODE = process.env.MODE || "check";
const BASE = process.env.APP_URL || "";
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();
const root = db.collection("houses").doc(HOUSE);

const riyadh = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit" });
const todayKey = riyadh.format(new Date());
const DEF = { start: "2026-11-17", order: ["محسن", "أمير", "نشوان", "علي"] };
const cfgSnap = await root.collection("config").doc("rota").get();
const cfg = { ...DEF, ...(cfgSnap.exists ? cfgSnap.data() : {}) };
const dd = (a, b) => Math.round((Date.parse(a) - Date.parse(b)) / 864e5);
const i = dd(todayKey, cfg.start);
const who = i < 0 ? null : cfg.order[((i % 4) + 4) % 4];
if (!who) { console.log("rota not started"); process.exit(0); }

const tokSnap = await root.collection("tokens").get();
const tokens = tokSnap.docs.map(d => ({ ref: d.ref, ...d.data() })).filter(t => t.token);
console.log(`${todayKey} who=${who} mode=${MODE} tokens=${tokens.length}`);

async function send(list, title, body, tag) {
  if (!list.length) return;
  const res = await admin.messaging().sendEachForMulticast({
    tokens: list.map(t => t.token),
    notification: { title, body },
    data: { title, body, tag, link: BASE },
    webpush: { notification: { title, body, icon: "icons/icon-192.png", dir: "rtl", lang: "ar", tag }, fcmOptions: BASE ? { link: BASE } : undefined },
  });
  for (const [k, r] of res.responses.entries()) {
    const code = r.error && r.error.code;
    if (code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token") await list[k].ref.delete();
  }
  console.log(`sent "${title}" ok=${res.successCount} fail=${res.failureCount}`);
}
const logRef = root.collection("logs").doc(todayKey);
const log = (await logRef.get()).data() || {};

if (MODE === "morning") {
  await send(tokens.filter(t => t.name !== who), "🧹 دور النظافة اليوم", `اليوم النظافة على ${who}`, "morning-" + todayKey);
  await send(tokens.filter(t => t.name === who), `🧹 اليوم دورك يا ${who}`, "افتح التطبيق، نفّذ القائمة، وصوّر بعد ما تخلص 📷", "morning-" + todayKey);
} else if (MODE === "evening") {
  if (!log.done) await send(tokens, "⏰ النظافة لسه ما توثّقت", `${who} لسه ما وثّق نظافة اليوم`, "evening-" + todayKey);
} else {
  if (log.done && !log.notified) {
    const n = (log.photos || []).length;
    await send(tokens, "✅ تمّت النظافة", `${log.doneBy || who} خلّص نظافة اليوم ووثّقها بـ ${n} صور`, "done-" + todayKey);
    await logRef.set({ notified: true }, { merge: true });
  }
}
process.exit(0);
