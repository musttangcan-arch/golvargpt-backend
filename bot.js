const axios = require("axios");
const TelegramBot = require("node-telegram-bot-api");
require("dotenv").config();

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: false });

const API = "https://golvargpt-backend.onrender.com";

// RAM cache (restart olursa sıfırlanır ama 6 saat koruma var)
const sentCache = new Map();

function cleanupCache() {
  const now = Date.now();

  for (const [key, time] of sentCache.entries()) {
    if (now - time > 21600000) {
      sentCache.delete(key);
    }
  }
}

async function sendNewGoalWatchSignal() {
  try {
    const response = await axios.get(`${API}/signals/goal-watch`);
    const signals = response.data.data || [];

    if (signals.length === 0) {
      console.log("No signals found.");
      return;
    }

    const newMatch = signals.find((match) => {
      const key = `${match.fixture_id}-HT05`;
      return !sentCache.has(key);
    });

    if (!newMatch) {
      console.log("No new signal to send.");
      return;
    }

    const message = `
🚨 İY 0.5 ÜST | HT 0.5 OVER

🏆 ${newMatch.league}
⚽ ${newMatch.home_team} vs ${newMatch.away_team}
📊 ${newMatch.home_goals}-${newMatch.away_goals}

🔥 GolvarGPT Live Signal
`;

    await bot.sendMessage(process.env.CHANNEL_ID, message);

    const key = `${newMatch.fixture_id}-HT05`;
    sentCache.set(key, Date.now());

    console.log("New signal sent.");
  } catch (error) {
    console.log("Send signal error:", error.message);
  }
}

async function checkResults() {
  try {
    cleanupCache();

    const response = await axios.get(`${API}/signals/goal-watch`);
    const matches = response.data.data || [];

    for (const match of matches) {
      const key = `${match.fixture_id}-HT05`;

      if (!sentCache.has(key)) continue;

      const totalGoals =
        Number(match.home_goals || 0) +
        Number(match.away_goals || 0);

      if (totalGoals >= 1) {
        await bot.sendMessage(
          process.env.CHANNEL_ID,
          `✅ WON\n${match.home_team} vs ${match.away_team}`
        );

        sentCache.delete(key);
        console.log("WON sent for", key);
      }
    }
  } catch (error) {
    console.log("Result check error:", error.message);
  }
}

async function runBot() {
  await sendNewGoalWatchSignal();
  await checkResults();
}

runBot();
setInterval(runBot, 60000);