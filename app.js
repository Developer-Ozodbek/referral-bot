const TelegramBot = require("node-telegram-bot-api");

const token = "6721010547:AAGNNp-GrqNoIJvl5AdnzDmvFuvCXLOXJjU"; // Replace with your actual bot token obtained from BotFather
const bot = new TelegramBot(token, { polling: true });

const userData = new Map();
const channels = ["refone_skill", "onetoskill", "refthree"];

// Replace the code within the '/start' handler with this:
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (!userData.has(userId)) {
    // New user
    userData.set(userId, { channelsSubscribed: [], referrals: [] });
    bot.sendMessage(
      chatId,
      "Welcome! Please subscribe to the following channels:",
      {
        reply_markup: {
          inline_keyboard: [
            channels.map((channel) => ({
              text: channel,
              url: `https://t.me/${channel}`,
            })),
            [{ text: "Verify", callback_data: "verify" }],
          ],
        },
      }
    );
  } else {
    // Existing user
    const user = userData.get(userId);
    const subscribedChannels = await Promise.all(
      channels.map((channel) => checkChannelMembership(userId, channel))
    );

    if (subscribedChannels.every((status) => status)) {
      handleReferralLinkMessage(userId);
    } else {
      const inlineKeyboard = channels.map((channel) => ({
        text: channel,
        url: `https://t.me/${channel}`,
      }));

      bot.sendMessage(userId, "Please subscribe to the following channels:", {
        reply_markup: {
          inline_keyboard: [
            inlineKeyboard,
            [{ text: "Verify", callback_data: "verify" }],
          ],
        },
      });
    }
  }
});

// Handle referral link usage
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const messageText = msg.text || '';
  const referredUserId = messageText.split(" ")[1];


  if (referredUserId && userData.has(referredUserId)) {
    const referredUser = userData.get(referredUserId);

    if (!referredUser.referrals.includes(userId)) {
      referredUser.referrals.push(userId);
      handleReferralLinkUsage(referredUser, userId, chatId);
      notifyReferrerAboutNewReferral(referredUserId, userId); // Notify the referrer
    } else {
      bot.sendMessage(chatId, "You have already used this referral link!");
    }
  }
});


// Handle inline button presses
bot.on("callback_query", async (callbackQuery) => {
  const userId = callbackQuery.from.id;
  const data = callbackQuery.data;

  if (data === "verify") {
    if (userData.has(userId)) {
      const user = userData.get(userId);
      const subscribedChannels = await Promise.all(
        channels.map((channel) => checkChannelMembership(userId, channel))
      );

      if (subscribedChannels.every((status) => status)) {
        handleReferralLinkMessage(userId, callbackQuery);
      } else {
        bot.sendMessage(
          userId,
          "You should subscribe to all 3 channels first!"
        );
      }
    } else {
      bot.sendMessage(userId, "Please start the bot first!");
    }
  } else if (channels.includes(data)) {
    handleChannelCallback(userId, data);
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
async function handleReferralLinkMessage(userId, callbackQuery) {
  const referralLink = `https://t.me/skillswapacademy_bot?start=${userId}`;
  const referralMessage = `🔥 Eng so'ngi IELTS 9 So'hiblari va 6 yillik eng tajribali ustozlardan bepul FULL IELTS kursi\n\nQatnashishingizni tavsiya qilaman 👇\n\n[Bepul FULL IELTS kursi](${referralLink})`;
  const gifUrl = "https://media.giphy.com/media/8VrtCswiLDNnO/giphy.gif"; // Replace with your GIF URL

  const detailForMessage = `🔝 Postni do'stlaringizga yuboring.\n\n5 ta do'stingiz sizning taklif havolingiz orqali bot'ga kirib kanallarga a'zo bo'lsa, bot sizga kurs uchun bir martalik link beradi.\n\nBot'da biror xatolikni topsangiz @course_by_native_speakersbot ga murojaat qiling.`;

  return bot
    .sendDocument(userId, gifUrl, {
      caption: referralMessage,
      parse_mode: "Markdown",
    })
    .then(() => {
      bot.deleteMessage(userId, callbackQuery?.message?.message_id);
    })
    .then(() => bot.sendMessage(userId, detailForMessage));
}
