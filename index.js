const { Telegraf, Markup } = require("telegraf");
const fs = require("fs");

// Bot tokeningiz
const bot = new Telegraf("8003713738:AAEbxOwYzkhdIROGeDziAkqAQbVCoFf06ME");

// JSON fayllar
const USERS_FILE = "users.json";
const CONFIG_FILE = "config.json";

// Fayldan o‘qish
function readJson(file, defaultValue) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return defaultValue;
  }
}

// Faylga yozish
function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// Users va Configni yuklash
let users = readJson(USERS_FILE, {}); // userId: { name, username, voted }
let config = readJson(CONFIG_FILE, { ADMIN_SECRET: "ssaidolim", voteCount: 0 });

// Slash komandalar menyusi
bot.telegram.setMyCommands([
  { command: "start", description: "Botni ishga tushirish" },
  { command: "help", description: "Yordam olish" },
  { command: "admin", description: "Admin rejimiga kirish" },
]);

// Admin sessionlari
const adminSessions = new Set();
const secretChangeSessions = new Map(); // adminId -> step

// /start komandasi
bot.start((ctx) => {
  const userId = ctx.from.id;
  const name = ctx.from.first_name || "Noma’lum";
  const username = ctx.from.username ? `@${ctx.from.username}` : "❌ username yo‘q";

  if (!users[userId]) {
    users[userId] = { name, username, voted: false };
    writeJson(USERS_FILE, users);
  }

  ctx.reply(
    `👋 Salom, ${name}!\n\nopen budgetga ovoz berish uchun\n\nQuyidagi tugmalardan foydalaning 👇`,
    Markup.keyboard([
      ["🗳 Ovoz berish"],
      ["📊 Hisobim"],
      ["📞 Murojat", "📖 Qo‘llanma"],
    ]).resize()
  );
});

// 🗳 Ovoz berish tugmasi
bot.hears("🗳 Ovoz berish", (ctx) => {
  const userId = ctx.from.id;
  if (users[userId] && !users[userId].voted) {
    users[userId].voted = true;
    config.voteCount += 1;
    writeJson(USERS_FILE, users);
    writeJson(CONFIG_FILE, config);
  }
  ctx.reply(
    "✅ Ovoz berish uchun quyidagi havolaga o‘ting:",
    Markup.inlineKeyboard([
      [
        Markup.button.url(
          "👉 Ovoz berish",
          "https://openbudget.uz/boards/initiatives/initiative/52/988b3d1e-bf60-45de-b28e-ff477da7f1d8"
        ),
      ],
    ])
  );
});

// 📊 Hisobim tugmasi
bot.hears("📊 Hisobim", (ctx) => {
  const hisob = config.voteCount * 30000;
  ctx.reply(`📊 Jami ovozlaringiz hisobida: ${hisob.toLocaleString()} so‘m ekvivalentida natija bor.`);
});

// 📞 Murojat tugmasi
bot.hears("📞 Murojat", (ctx) => {
  ctx.reply("Savollar uchun admin: @openb_104admin");
});

// 📖 Qo‘llanma tugmasi
bot.hears("📖 Qo‘llanma", (ctx) => {
  ctx.reply(
    "📖 Qo‘llanma:\n\n1. '🗳 Ovoz berish' tugmasini bosing va link orqali ovoz bering.\n" +
    "2. '📊 Hisobim' tugmasida umumiy hisobni ko‘rishingiz mumkin.\n" +
    "3. '📞 Murojat' tugmasi orqali admin bilan bog‘lanishingiz mumkin."
  );
});

// /help komandasi
bot.command("help", (ctx) => {
  ctx.reply("ℹ️ Yordam uchun: '🗳 Ovoz berish', '📊 Hisobim', '📞 Murojat' tugmalaridan foydalaning.");
});

// /admin komandasi
bot.command("admin", (ctx) => {
  ctx.reply("🔑 Maxfiy so‘zni kiriting:");
});

// Admin menyu tugmalari
function adminMenu() {
  return Markup.keyboard([
    ["👥 Start bosganlar"],
    ["🗳 Ovoz berganlar"],
    ["⚙️ Sozlamalar"],
  ]).resize();
}

// Admin matnlarni tinglash
bot.on("text", (ctx) => {
  const text = ctx.message.text;
  const userId = ctx.from.id;

  // Agar maxfiy so‘z jarayonida bo‘lsa
  if (secretChangeSessions.has(userId)) {
    const step = secretChangeSessions.get(userId);

    if (step.stage === "old") {
      if (text === config.ADMIN_SECRET) {
        secretChangeSessions.set(userId, { stage: "new" });
        ctx.reply("✍️ Yangi maxfiy so‘zni kiriting:");
      } else {
        ctx.reply("❌ Eski maxfiy so‘z noto‘g‘ri. Jarayon bekor qilindi.");
        secretChangeSessions.delete(userId);
      }
      return;
    }

    if (step.stage === "new") {
      secretChangeSessions.set(userId, { stage: "confirm", newSecret: text });
      ctx.reply("✅ Yangi maxfiy so‘zni tasdiqlash uchun qayta yozing:");
      return;
    }

    if (step.stage === "confirm") {
      if (text === step.newSecret) {
        config.ADMIN_SECRET = text;
        writeJson(CONFIG_FILE, config);
        ctx.reply("🎉 Maxfiy so‘z muvaffaqiyatli o‘zgartirildi!");
      } else {
        ctx.reply("❌ Tasdiqlash mos kelmadi. Jarayon bekor qilindi.");
      }
      secretChangeSessions.delete(userId);
      return;
    }
  }

  // Agar maxfiy so‘zni kiritayotgan bo‘lsa
  if (text === config.ADMIN_SECRET) {
    adminSessions.add(userId);
    ctx.reply("✅ Admin rejimiga muvaffaqiyatli kirdingiz!", adminMenu());
    return;
  }

  // Admin menyusi
  if (adminSessions.has(userId)) {
    if (text === "👥 Start bosganlar") {
      const allUsers = Object.values(users);
      if (allUsers.length === 0) return ctx.reply("❌ Hali hech kim start bosmagan.");
      let msg = `👥 Start bosgan foydalanuvchilar (jami: ${allUsers.length}):\n\n`;
      allUsers.forEach((u, i) => {
        msg += `${i + 1}. ${u.name} (${u.username})\n`;
      });
      ctx.reply(msg);
    }

    if (text === "🗳 Ovoz berganlar") {
      const votedUsers = Object.values(users).filter((u) => u.voted);
      if (votedUsers.length === 0) return ctx.reply("❌ Hali hech kim ovoz bermagan.");
      let msg = `🗳 Ovoz bergan foydalanuvchilar (jami: ${votedUsers.length}):\n\n`;
      votedUsers.forEach((u, i) => {
        msg += `${i + 1}. ${u.name} (${u.username})\n`;
      });
      ctx.reply(msg);
    }

    if (text === "⚙️ Sozlamalar") {
      ctx.reply(
        "⚙️ Sozlamalar:",
        Markup.keyboard([["🔑 Maxfiy so‘zni o‘zgartirish"], ["⬅️ Ortga"]]).resize()
      );
    }

    if (text === "🔑 Maxfiy so‘zni o‘zgartirish") {
      ctx.reply("🔐 Eski maxfiy so‘zni kiriting:");
      secretChangeSessions.set(userId, { stage: "old" });
    }

    if (text === "⬅️ Ortga") {
      ctx.reply("↩️ Admin menyuga qaytdingiz", adminMenu());
    }
  }
});

bot.launch();
console.log("🚀 Bot ishga tushdi...");
