// Load environment variables
require("dotenv").config();

// Initialize Telegram bot and MongoDB connection
const TelegramBot = require("node-telegram-bot-api");
const token = process.env.BOT_TOKEN; // Replace with your actual bot token obtained from BotFather
const bot = new TelegramBot(token, { polling: true });
const mongoose = require("mongoose");

// Connect to MongoDB using the provided URI
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Define Mongoose User model
const User = mongoose.model("User", {
  telegramId: Number,
  channelsSubscribed: Boolean,
  referrals: Number,
  enterBotByReferral: Boolean,
  canUserGetCourses: Boolean,
});

// Bot username and channel list
const botUsername = "https://t.me/skillswapacademy_bot";
const channels = ["refone_skill", "onetoskill", "refthree"];
const userShouldRefer = 2;
let referrer;

// Handler for '/start' command without parameters
bot.onText(/\/start$/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  try {
    const existingUser = await User.findOne({ telegramId: userId });

    // Call start function based on user existence
    if (!existingUser) {
      start(userId, chatId, true);
    } else {
      start(userId, chatId, false);
    }
  } catch (error) {
    console.error(`Error in bot.onText() 46: ${error}`);
  }
});

// Handler for '/start' command with parameters
bot.onText(/\/start (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const referralParam = match[1]; // Extract referral parameter from /start command

  try {
    const existingUser = await User.findOne({ telegramId: userId });

    if (!existingUser) {
      referrer = await User.findOne({ telegramId: referralParam });
      if (referrer) {
        start(userId, chatId, true);
      } else {
        bot.sendMessage(
          userId,
          "Afsuski, sizni taklif qilgan foydalanuvchi topilmadi :(\nIltimos sizni taklif qilgan foydalanuvchiga botga qayta kirishini so'rang."
        );
      }
    } else {
      start(userId, chatId, false);
    }
  } catch (error) {
    console.error(`Error in bot.onText(): ${error}`);
  }
});

// Handler for '/info' command
bot.onText(/\/info/, async (msg) => {
  const userId = msg.from.id;

  try {
    const user = await User.findOne({ telegramId: userId });

    if (!user) {
      // User not found, handle accordingly
      bot.sendMessage(
        userId,
        "Siz hali botga start bermadingiz, /info buyrug'ini berishdan oldin,\n/start buyrug'ini ishga soling"
      );
      return;
    }

    const userDidRefferalInfo = user.referrals >= userShouldRefer ? "✅" : "❌";

    const requirements = `Siz Darsliklarni olishingiz uchun quyidagilarni bajarishingiz kerak xolos: \n1. ${channels.length}ta kanal(lar)ga obuna bo'lishingiz kerak. \n2. Kamida 5 ta do'stingizni botga taklif qilishingiz kerak va toki ular ham ${channels.length} ta kanal(lar)ga obuna bo'lmagunicha, sizga referral qo'shilmaydi`;

    const referralInfo = user.referrals
      ? `${userDidRefferalInfo}Siz foydalanuvchilarni botga taklif qilganlar soningiz: ${user.referrals} ta.`
      : "Hali xech kimni botga taklif qilganingiz yo'q :(";

    const subscriptionInfo = user.channelsSubscribed
      ? `${user.channelsSubscribed}Siz barcha ${channels.length} ta obuna bo'lishingiz kerak bo'lgan kanallarga obuna bo'lgansiz`
      : `Siz hali ${channels.length} ta kanalga obuna bo'lmadingiz :(`;

    const howIsItEntered = user.enterBotByReferral
      ? "Siz ushbu botga referral link orqali qo'shildingiz!"
      : "Siz ushbu botga o'zingiz qo'shildingiz!\n(xech qanday referral linklarsiz)";

    const message = `ℹ️ Information:\n Siz bajarishingiz kerak bo'lgan SHARTLAR:\n${requirements}\n ➖➖➖➖➖➖➖➖➖➖➖➖ \nSiz haqingizda MA'LUMOTLAR:\n ${referralInfo}\n${subscriptionInfo}\n${howIsItEntered}`;

    bot.sendMessage(userId, message);
  } catch (error) {
    console.error(`Error in /info command: ${error}`);
    bot.sendMessage(userId, "An error occurred while fetching information.");
  }
});

// This functions is used when user start bot
async function start(userId, chatId, isUserNew) {
  const user = await User.findOne({ telegramId: userId });

  if (isUserNew) {
    // Prompt the user to verify by subscribing to channels
    userHaveToVerify(chatId);
  } else {
    if (await userSubscribedChannelsOrNot(userId)) {
      if (user.canUserGetCourses) {
        // Inform user about eligibility to access courses
        bot.sendMessage(userId, "Endi siz kurslarga ega bo'laolasiz!!");
        return false;
      }
      return handleReferralLinkMessage(userId);
    } else {
      // User needs to verify subscription to channels
      userHaveToVerify(chatId);
    }
  }
}

// Function to verify if a user has subscribed to the required channels
async function userHaveToVerify(chatId, userId) {
  try {
     // Keyboard for channel subscription verification
    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          [{ text: "1-Kanal", url: `https://t.me/${channels[0]}` }],
          [{ text: "2-Kanal", url: `https://t.me/${channels[1]}` }],
          [{ text: "3-Kanal", url: `https://t.me/${channels[2]}` }],
          [{ text: "Verify", callback_data: "verify" }],
        ],
      },
    };

    // Prompt users to subscribe to channels for verification
    await bot.sendMessage(
      chatId,
      "Iltimos, quyidagi kanallarga obuna bo'ling va Tekshirish tugmasini bosing:",
      keyboard
    );
    return true;
  } catch (error) {
    console.error(`Error in userHaveToVerify: ${error.message}`);
    return false;
  }
}

// Verify inline button
bot.on("callback_query", async (callbackQuery) => {
  try {
    const userId = callbackQuery.from.id;
    const data = callbackQuery.data;

    if (data === "verify") {
      if (await userSubscribedChannelsOrNot(userId)) {
        const newUser = new User({
          telegramId: userId,
          channelsSubscribed: true,
          referrals: 0,
          enterBotByReferral: true,
          canUserGetCourses: false,
        });
        await newUser.save();

        if (referrer) {
          referrer.referrals += 1;
          await referrer.save();

          // Notify the referrer about successful referral
          await bot.sendMessage(
            referrer.telegramId,
            `+1 ta foydalanuvchi sizning referral linkingiz orqali botga qo'shildi! jami referrallar soningiz: ${referrer.referrals} ta`
          );

          // Notify referrer upon reaching 5 referrals
          if (referrer.referrals == userShouldRefer) {
            bot.sendMessage(
              referrer.telegramId,
              `Tabriklaymiz!! siz ${userShouldRefer} ta referral yig'dingiz, endi darsliklarga ega bo'lishingiz mumkin!`
            );
            await User.findOneAndUpdate(
              { telegramId: referrer.telegramId },
              { canUserGetCourses: true }
            );
          }
        }

        // Update 'channelsSubscribed' to true upon successful subscription
        return handleReferralLinkMessage(userId, callbackQuery);
      } else {
        await User.updateOne(
          { telegramId: userId },
          { channelsSubscribed: false }
        );
        bot.sendMessage(
          userId,
          `Barcha ${channels.length} ta kanalga obuna bo'lishingiz shart!`
        );
      }
    }
  } catch (error) {
    console.error(`Error occurred at line 141: ${error}`);
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

async function handleReferralLinkMessage(userId, callbackQuery) {
  const referralLink = `${botUsername}?start=${userId}`;
  const referralMessage = `🔥 Eng so'ngi IELTS 9 So'hiblari va 6 yillik eng tajribali ustozlardan bepul FULL IELTS kursi\n\nQatnashishingizni tavsiya qilaman 👇\n\n[Bepul FULL IELTS kursi](${referralLink})`;
  const gifUrl = "https://media.giphy.com/media/8VrtCswiLDNnO/giphy.gif"; // Replace with your GIF URL

  const detailForMessage = `🔝 Postni do'stlaringizga yuboring.\n\n5 ta do'stingiz sizning taklif havolingiz orqali bot'ga kirib kanallarga a'zo bo'lsa, bot sizga kurs uchun bir martalik link beradi.\n\nBot'da biror xatolikni topsangiz @course_by_native_speakersbot ga murojaat qiling.`;

  try {
    await bot.sendDocument(userId, gifUrl, {
      caption: referralMessage,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Bepul FULL IELTS kursi",
              url: `https://t.me/SkillSwapAcademy`,
            },
          ],
        ],
      },
    });

    if (callbackQuery?.message?.message_id) {
      await bot.deleteMessage(userId, callbackQuery.message.message_id);
    }

    await bot.sendMessage(userId, detailForMessage);
  } catch (error) {
    console.error(`Error in handleReferralLinkMessage: ${error.message}`);
  }
}

async function userSubscribedChannelsOrNot(userId) {
  const subscribedChannels = await Promise.all(
    channels.map((channel) => checkChannelMembership(userId, channel))
  );
  return subscribedChannels.every((status) => status);
}
