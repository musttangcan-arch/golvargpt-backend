const axios = require("axios");
const TelegramBot = require("node-telegram-bot-api");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: false });

const API = "https://golvargpt-backend.onrender.com";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function alreadySentRecently(fixtureId, signalType) {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("sent_signals")
    .select("id")
    .eq("fixture_id", String(fixtureId))
    .eq("signal_type", signalType)
    .gte("sent_at", oneHourAgo)
    .limit(1);

  if (error) {
    console.log("Supabase check error:", error.message);
    return false;
  }

  return data && data.length > 0;
}

async function saveSignal(fixtureId, signalType) {
  const { error } = await supabase.from("sent_signals").insert({
    fixture_id: String(fixtureId),
    signal_type: signalType,
    status: "pending"
  });

  if (error) {
    console.log("Supabase insert error:", error.message);
  }
}

async function updateSignalStatus(fixtureId, signalType, status) {
  const { error } = await supabase
    .from("sent_signals")
    .update({ status })
    .eq("fixture_id", String(fixtureId))
    .eq("signal_type", signalType)
    .eq("status", "pending");

  if (error) {
    console.log("Supabase update error:", error.message);
  }
}

async function getPendingSignals() {
  const { data, error } = await supabase
    .from("sent_signals")
    .select("*")
    .eq("status", "pending")
    .order("sent_at", { ascending: true });

  if (error) {
    console.log("Supabase pending fetch error:", error.message);
    return [];
  }

  return data || [];
}

async function sendNewGoalWatchSignal() {
  try {
    const response = await axios.get(`${API}/signals/goal-watch`);
    const signals = response.data.data || [];

    if (signals.length === 0) {
      console.log("No signals found.");
      return;
    }

    for (const match of signals) {
      const duplicate = await alreadySentRecently(match.fixture_id, "HT05");

      if (duplicate) {
        continue;
      }

      const message =
`🚨 İY 0.5 ÜST | HT 0.5 OVER

🏆 ${match.league}
⚽ ${match.home_team} vs ${match.away_team}
⏱ ${match.minute}'
📊 ${match.home_goals}-${match.away_goals}

🔥 GolvarGPT Live Signal`;

      await bot.sendMessage(process.env.CHANNEL_ID, message);
      await saveSignal(match.fixture_id, "HT05");

      console.log("New signal sent.");
      return;
    }

    console.log("No new signal to send.");
  } catch (error) {
    console.log("Send signal error:", error.response?.data || error.message);
  }
}

async function checkResults() {
  try {
    const pendingSignals = await getPendingSignals();

    if (pendingSignals.length === 0) {
      console.log("No pending results to check.");
      return;
    }

    for (const signal of pendingSignals) {
      const response = await axios.get(`${API}/fixture/${signal.fixture_id}`);
      const match = response.data.data;

      if (!match) {
        continue;
      }

      const totalGoals =
        Number(match.home_goals || 0) +
        Number(match.away_goals || 0);

      const firstHalfEnded =
        match.short_status === "HT" ||
        match.short_status === "2H" ||
        match.short_status === "FT" ||
        Number(match.minute || 0) >= 45;

      if (totalGoals >= 1) {
        const wonMessage =
`✅ WON

🏆 ${match.league || ""}
⚽ ${match.home_team} vs ${match.away_team}
🎯 İY 0.5 ÜST Kazandı
📊 ${match.home_goals}-${match.away_goals}`;

        await bot.sendMessage(process.env.CHANNEL_ID, wonMessage);
        await updateSignalStatus(signal.fixture_id, signal.signal_type, "won");

        console.log(`WON sent for ${signal.fixture_id}`);
      } else if (firstHalfEnded && totalGoals === 0) {
        const lostMessage =
`❌ LOST

🏆 ${match.league || ""}
⚽ ${match.home_team} vs ${match.away_team}
🎯 İY 0.5 ÜST Kaybetti
📊 ${match.home_goals}-${match.away_goals}`;

        await bot.sendMessage(process.env.CHANNEL_ID, lostMessage);
        await updateSignalStatus(signal.fixture_id, signal.signal_type, "lost");

        console.log(`LOST sent for ${signal.fixture_id}`);
      }
    }
  } catch (error) {
    console.log("Check result error:", error.response?.data || error.message);
  }
}

async function runBot() {
  await sendNewGoalWatchSignal();
  await checkResults();
}

runBot();
setInterval(runBot, 60000);