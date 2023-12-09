const TelegramBot = require("node-telegram-bot-api");
const token = "6721010547:AAGNNp-GrqNoIJvl5AdnzDmvFuvCXLOXJjU"; // Replace with your actual bot token obtained from BotFather
const bot = new TelegramBot(token, { polling: true });
const mongoose = require("mongoose");

mongoose.connect(
  "mongodb+srv://ozodbek:ozodbek@cluster0.zxeu8tk.mongodb.net/?retryWrites=true&w=majority",
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }
);

const User = mongoose.model("User", {
  telegramId: Number,
  channelsSubscribed: [String],
  referrals: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
});

const userData = new Map();
const channels = ["refone_skill", "onetoskill", "refthree"];

// Replace the code within the '/start' handler with this:
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const existingUser = await User.findOne({ telegramId: userId });

  try {
    if (!existingUser) {
      // New user
      const newUser = new User({
        telegramId: userId,
        channelsSubscribed: [],
        referrals: [],
      });

      await newUser.save();

      start(userId, chatId, true);
    } else {
      start(userId, chatId, false);
    }
  } catch (error) {
    console.error(`error occured in bot.onText(): the error: ${error}`);
  }
});

// This functions is used when user start bot
async function start(userId, chatId, isUserNew) {
  const subscribedChannels = await Promise.all(
    channels.map((channel) => checkChannelMembership(userId, channel))
  );

  if (isUserNew) {
    userHaveToVerify(chatId);
  } else {
    if (subscribedChannels.every((status) => status)) {
      return handleReferralLinkMessage(userId);
    } else {
      // bot.sendMessage(userId, "You should subscribe all 3 channels");
      userHaveToVerify(chatId)
    }
  }
}

// Verifing user subscribed channels or not
function userHaveToVerify(chatId) {
  return bot.sendMessage(
    chatId,
    "Welcome! Please subscribe to the following channels:",
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "1-Kanal", url: `https://t.me/${channels[0]}` }],
          [{ text: "2-Kanal", url: `https://t.me/${channels[1]}` }],
          [{ text: "3-Kanal", url: `https://t.me/${channels[2]}` }],
          [{ text: "Verify", callback_data: "verify" }],
        ],
      },
    }
  );
}

// Verify inline button
bot.on("callback_query", async (callbackQuery) => {
  const userId = callbackQuery.from.id;
  const data = callbackQuery.data;
  const subscribedChannels = await Promise.all(
    channels.map((channel) => checkChannelMembership(userId, channel))
  );

  if (data === "verify") {
    if (subscribedChannels.every((status) => status)) {
      return handleReferralLinkMessage(userId, callbackQuery);
    } else {
      bot.sendMessage(userId, "You should subscribe all 3 channels");
    }
  }
});

// Helper function to check user's membership in a channel
async function checkChannelMembership(userId, channel) {
  try {
    const chatMember = await bot.getChatMember(`@${channel}`, userId);
    return (
      chatMember.status === "member" ||
      chatMember.status === "administrator" ||
      chatMember.status === "creator"
    );
  } catch (error) {
    console.error(
      `Error checking channel membership for ${userId} in ${channel}: ${error.message}`
    );
    return false;
  }
}

// Referral link message handler
// async function handleReferralLinkMessage(userId, callbackQuery) {
//   const referralLink = `https://t.me/skillswapacademy_bot?start=${userId}`;
//   const referralMessage = `🔥 Eng so'ngi IELTS 9 So'hiblari va 6 yillik eng tajribali ustozlardan bepul FULL IELTS kursi\n\nQatnashishingizni tavsiya qilaman 👇\n\n[Bepul FULL IELTS kursi](${referralLink})`;
//   const gifUrl = "https://media.giphy.com/media/8VrtCswiLDNnO/giphy.gif"; // Replace with your GIF URL

//   const detailForMessage = `🔝 Postni do'stlaringizga yuboring.\n\n5 ta do'stingiz sizning taklif havolingiz orqali bot'ga kirib kanallarga a'zo bo'lsa, bot sizga kurs uchun bir martalik link beradi.\n\nBot'da biror xatolikni topsangiz @course_by_native_speakersbot ga murojaat qiling.`;

//   return bot
//     .sendDocument(userId, gifUrl, {
//       caption: referralMessage,
//       parse_mode: "Markdown",
//     })
//     .then(() => {
//       bot.deleteMessage(userId, callbackQuery?.message?.message_id);
//     })
//     .then(() => bot.sendMessage(userId, detailForMessage));
// }

async function handleReferralLinkMessage(userId, callbackQuery) {
  const referralLink = `https://t.me/skillswapacademy_bot?start=${userId}`;
  const referralMessage = `🔥 Eng so'ngi IELTS 9 So'hiblari va 6 yillik eng tajribali ustozlardan bepul FULL IELTS kursi\n\nQatnashishingizni tavsiya qilaman 👇\n\n[Bepul FULL IELTS kursi](${referralLink})`;
  const gifUrl = "https://media.giphy.com/media/8VrtCswiLDNnO/giphy.gif"; // Replace with your GIF URL

  const detailForMessage = `🔝 Postni do'stlaringizga yuboring.\n\n5 ta do'stingiz sizning taklif havolingiz orqali bot'ga kirib kanallarga a'zo bo'lsa, bot sizga kurs uchun bir martalik link beradi.\n\nBot'da biror xatolikni topsangiz @course_by_native_speakersbot ga murojaat qiling.`;

  try {
    await bot.sendDocument(userId, gifUrl, {
      caption: referralMessage,
      parse_mode: "Markdown",
    });
    
    if (callbackQuery?.message?.message_id) {
      await bot.deleteMessage(userId, callbackQuery.message.message_id);
    }

    await bot.sendMessage(userId, detailForMessage);
  } catch (error) {
    console.error(`Error in handleReferralLinkMessage: ${error.message}`);
  }
}
