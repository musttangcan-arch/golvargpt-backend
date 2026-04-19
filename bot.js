const axios = require("axios");
const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");
require("dotenv").config();

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: false });
const FILE_PATH = "sentSignals.json";

function loadSignals() {
  try {
    if (!fs.existsSync(FILE_PATH)) {
      fs.writeFileSync(FILE_PATH, "[]");
    }
    return JSON.parse(fs.readFileSync(FILE_PATH, "utf8"));
  } catch (error) {
    return [];
  }
}

function saveSignals(signals) {
  fs.writeFileSync(FILE_PATH, JSON.stringify(signals, null, 2));
}

async function sendNewGoalWatchSignal() {
  try {
    const response = await axios.get("http://localhost:5000/signals/goal-watch");
    const signals = response.data.data || [];
    const savedSignals = loadSignals();

    if (signals.length === 0) {
      console.log("No signals found.");
      return;
    }

    const newMatch = signals.find((match) => {
      return !savedSignals.some(
        (saved) =>
          saved.fixture_id === match.fixture_id &&
          saved.signal_type === "HT05"
      );
    });

    if (!newMatch) {
      console.log("No new signal to send.");
      return;
    }

    const message =
`🚨 İY 0.5 ÜST | HT 0.5 OVER

🏆 ${newMatch.league}
⚽ ${newMatch.home_team} vs ${newMatch.away_team}
⏱ ${newMatch.minute}'
📊 ${newMatch.home_goals}-${newMatch.away_goals}

🔥 GolvarGPT Live Signal`;

    await bot.sendMessage(process.env.CHANNEL_ID, message);

    savedSignals.push({
      fixture_id: newMatch.fixture_id,
      league: newMatch.league,
      home_team: newMatch.home_team,
      away_team: newMatch.away_team,
      signal_type: "HT05",
      status: "pending"
    });

    saveSignals(savedSignals);
    console.log("New signal sent.");
  } catch (error) {
    console.error("Send signal error:", error.response?.data || error.message);
  }
}

async function checkResults() {
  try {
    const savedSignals = loadSignals();

    for (const signal of savedSignals) {
      if (signal.status !== "pending") continue;

      const response = await axios.get(`http://localhost:5000/fixture/${signal.fixture_id}`);
      const match = response.data.data;

      if (!match) continue;

      const totalGoals = (match.home_goals || 0) + (match.away_goals || 0);

      const firstHalfEnded =
        match.short_status === "HT" ||
        match.short_status === "2H" ||
        match.short_status === "FT" ||
        match.minute >= 45;

      if (totalGoals >= 1) {
        const wonMessage =
`✅ WON

🏆 ${signal.league}
⚽ ${signal.home_team} vs ${signal.away_team}
🎯 İY 0.5 ÜST Kazandı
📊 ${match.home_goals}-${match.away_goals}`;

        await bot.sendMessage(process.env.CHANNEL_ID, wonMessage);
        signal.status = "won";
        console.log(`WON sent for ${signal.fixture_id}`);
      } else if (firstHalfEnded && totalGoals === 0) {
        const lostMessage =
`❌ LOST

🏆 ${signal.league}
⚽ ${signal.home_team} vs ${signal.away_team}
🎯 İY 0.5 ÜST Kaybetti
📊 ${match.home_goals}-${match.away_goals}`;

        await bot.sendMessage(process.env.CHANNEL_ID, lostMessage);
        signal.status = "lost";
        console.log(`LOST sent for ${signal.fixture_id}`);
      }
    }

    saveSignals(savedSignals);
  } catch (error) {
    console.error("Check result error:", error.response?.data || error.message);
  }
}

async function runBot() {
  await sendNewGoalWatchSignal();
  await checkResults();
}

runBot();
setInterval(runBot, 120000);