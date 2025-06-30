const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const app = express();
const PORT = process.env.PORT || 3000;

// إعدادات العميل المحسنة
const client = new Client({
  authStrategy: new LocalAuth({
    dataPath: 'session' // لحفظ الجلسات بشكل دائم
  }),
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process'
    ],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || 
                  '/usr/bin/chromium-browser'
  }
});

// أحداث العميل
client.on('qr', qr => {
  qrcode.generate(qr, { small: true });
  console.log('🔍 امسح رمز QR أعلاه للاتصال');
});

client.on('ready', () => {
  console.log('✅ العميل جاهز للاستخدام!');
});

client.on('disconnected', (reason) => {
  console.log('⚠️ تم قطع الاتصال:', reason);
  console.log('⏳ إعادة الاتصال...');
  client.initialize();
});

// معالجة الأخطاء غير الملتقطة
process.on('unhandledRejection', (error) => {
  console.error('⚠️ خطأ غير معالج:', error);
});

// middleware
app.use(express.json());

// نقطة نهاية إرسال الرسالة
app.post('/send-message', async (req, res) => {
  const { number, message } = req.body;
  
  if (!number || !message) {
    return res.status(400).json({ error: 'يجب إدخال رقم ورسالة' });
  }

  try {
    const chatId = number.endsWith('@c.us') ? number : `${number}@c.us`;
    
    if (!client.info) {
      return res.status(503).json({ error: 'العميل غير جاهز بعد' });
    }

    await client.sendMessage(chatId, message);
    console.log(`📩 تم إرسال رسالة إلى ${chatId}`);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ فشل الإرسال:', error);
    res.status(500).json({ 
      error: 'فشل إرسال الرسالة',
      details: error.message
    });
  }
});

// نقطة فحص الصحة
app.get('/health', (req, res) => {
  const status = client.info ? 'connected' : 'connecting';
  res.json({ 
    status,
    qrNeeded: !client.info,
    uptime: process.uptime()
  });
});

// بدء التشغيل
const startServer = async () => {
  try {
    await client.initialize();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🖥️ الخادم يعمل على http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('❌ فشل بدء التشغيل:', error);
    process.exit(1);
  }
};

startServer();