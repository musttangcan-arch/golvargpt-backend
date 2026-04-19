const express = require("express");
const axios = require("axios");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());

const API_BASE = "https://v3.football.api-sports.io";

const allowedLeagues = [
  "Premier League",
  "Serie A",
  "La Liga",
  "Bundesliga",
  "Ligue 1",
  "Championship",
  "Eredivisie",
  "Primeira Liga",
  "Belgian Pro League",
  "Super Lig",
  "Scottish Premiership",
  "Swiss Super League",
  "Austrian Bundesliga",
  "Czech Liga",
  "Czech First League",
  "Greek Super League",
  "Danish Superliga",
  "Eliteserien",
  "Allsvenskan",
  "Ekstraklasa",
  "HNL",
  "Brazil Serie A",
  "Brazil Serie B",
  "Liga Profesional Argentina",
  "Major League Soccer",
  "Liga MX"
];

const blockedWords = [
  "Reserve",
  "Reserves",
  "Youth",
  "U19",
  "U20",
  "U21",
  "U23",
  "Women",
  "Female",
  "Friendly",
  "Friendlies",
  "Amateur",
  "Regional"
];

function isAllowedLeague(leagueName) {
  if (!leagueName) return false;

  const lowerLeague = leagueName.toLowerCase();

  const isBlocked = blockedWords.some(word =>
    lowerLeague.includes(word.toLowerCase())
  );

  if (isBlocked) return false;

  const isAllowed = allowedLeagues.some(name =>
    lowerLeague.includes(name.toLowerCase())
  );

  return isAllowed;
}

async function getLiveMatches() {
  const response = await axios.get(`${API_BASE}/fixtures?live=all`, {
    headers: {
      "x-apisports-key": process.env.API_KEY
    }
  });

  return response.data.response.map((item) => ({
    fixture_id: item.fixture.id,
    league: item.league.name,
    country: item.league.country,
    home_team: item.teams.home.name,
    away_team: item.teams.away.name,
    minute: item.fixture.status.elapsed,
    status: item.fixture.status.long,
    short_status: item.fixture.status.short,
    home_goals: item.goals.home,
    away_goals: item.goals.away
  }));
}

async function getFixtureById(fixtureId) {
  const response = await axios.get(`${API_BASE}/fixtures?id=${fixtureId}`, {
    headers: {
      "x-apisports-key": process.env.API_KEY
    }
  });

  const item = response.data.response[0];

  if (!item) return null;

  return {
    fixture_id: item.fixture.id,
    league: item.league.name,
    country: item.league.country,
    home_team: item.teams.home.name,
    away_team: item.teams.away.name,
    minute: item.fixture.status.elapsed,
    status: item.fixture.status.long,
    short_status: item.fixture.status.short,
    home_goals: item.goals.home,
    away_goals: item.goals.away
  };
}

app.get("/", (req, res) => {
  res.send("GolvarGPT Live API Running");
});

app.get("/matches/live", async (req, res) => {
  try {
    const matches = await getLiveMatches();

    res.json({
      success: true,
      count: matches.length,
      data: matches
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.response?.data || error.message
    });
  }
});

app.get("/signals/goal-watch", async (req, res) => {
  try {
    const matches = await getLiveMatches();

    const signals = matches.filter((match) => {
      const minuteOk = match.minute >= 18 && match.minute <= 25;
      const scoreOk = match.home_goals === 0 && match.away_goals === 0;
      const leagueOk = isAllowedLeague(match.league);

      return minuteOk && scoreOk && leagueOk;
    });

    res.json({
      success: true,
      count: signals.length,
      data: signals
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.response?.data || error.message
    });
  }
});

app.get("/fixture/:id", async (req, res) => {
  try {
    const fixture = await getFixtureById(req.params.id);

    if (!fixture) {
      return res.status(404).json({
        success: false,
        message: "Fixture not found"
      });
    }

    res.json({
      success: true,
      data: fixture
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.response?.data || error.message
    });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log("Server started on port " + PORT);
});