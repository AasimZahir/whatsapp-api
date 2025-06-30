const { Client, LocalAuth } = require('whatsapp-web.js');
const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode');

const sessions = {};

function getSessionPath(sessionId) {
  return path.join(__dirname, 'sessions', sessionId);
}

async function startSession(sessionId) {
  if (sessions[sessionId]) return sessions[sessionId];

  const sessionDir = getSessionPath(sessionId);
  fs.mkdirSync(sessionDir, { recursive: true });

  const client = new Client({
    authStrategy: new LocalAuth({ dataPath: sessionDir }),
    puppeteer: { headless: true },
    takeoverOnConflict: true,
    takeoverTimeoutMs: 0,
    qrTimeoutMs: 30000,
  });

  sessions[sessionId] = { client, qr: null, ready: false };

  client.on('qr', (qr) => {
    console.log(`QR code received for session ${sessionId}`);
    sessions[sessionId].qr = qr;
  });

  client.on('ready', () => {
    console.log(`Session ${sessionId} is ready`);
    sessions[sessionId].ready = true;
  });

  client.on('auth_failure', msg => {
    console.error(`Auth failure for session ${sessionId}:`, msg);
    // يمكن هنا إضافة إعادة تهيئة الجلسة أو إشعار المستخدم
    sessions[sessionId].ready = false;
  });

  client.on('disconnected', (reason) => {
    console.warn(`Session ${sessionId} disconnected:`, reason);
    sessions[sessionId].ready = false;
    // إعادة تشغيل الجلسة تلقائيًا بعد 5 ثواني
    setTimeout(() => {
      console.log(`Reinitializing session ${sessionId}...`);
      client.initialize();
    }, 5000);
  });

  client.initialize();

  return sessions[sessionId];
}

async function getQR(sessionId) {
  const session = await startSession(sessionId);
  if (!session.qr) throw new Error('QR not yet generated');
  return await qrcode.toDataURL(session.qr);
}

async function sendMessage(sessionId, to, msg) {
  const session = await startSession(sessionId);

  if (!session.ready) {
    throw new Error('Session not ready');
  }

  const numberId = await session.client.getNumberId(to);
  if (!numberId) throw new Error('Invalid WhatsApp number');

  return session.client.sendMessage(numberId._serialized, msg);
}

module.exports = { startSession, getQR, sendMessage };
