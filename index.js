const express = require('express');
const fetch = require('node-fetch');
const app = express();

const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbiI6ImVjYzUyMzcyYWNmYzlkZTYiLCJpYXQiOjE3NzgzMjkwODcsIm5iZiI6MTc3ODMyOTA4NywiaXNzIjoiaHR0cHM6Ly93d3cuYmF0dGxlbWV0cmljcy5jb20iLCJzdWIiOiJ1cm46dXNlcjoxMTkyMDk5In0.2-TUDkH6J4_av5dwU73XdalD8JzMMtiOXsJ0edQCSbM';
const HEADERS = { 'Authorization': `Bearer ${TOKEN}`, 'Accept': 'application/json' };
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;

let cache = null;
let cacheTime = null;
let isRefreshing = false;

async function fetchServers() {
  const url = 'https://api.battlemetrics.com/servers?filter[game]=dayz&sort=-players&page[size]=100';
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`Servers fetch failed: ${res.status}`);
  return res.json();
}

async function fetchUptime(serverId) {
  try {
    const now = new Date();
    const start = new Date(now - THIRTY_DAYS_MS).toISOString();
    const url = `https://api.battlemetrics.com/servers/${serverId}/relationships/sessions?start=${start}&limit=100`;
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) return null;
    const json = await res.json();

    const sessions = json.data || [];
    if (sessions.length === 0) return null;

    let onlineMs = 0;
    const windowStart = now - THIRTY_DAYS_MS;

    for (const session of sessions) {
      const sessionStart = Math.max(new Date(session.attributes.start).getTime(), windowStart);
      const stop = session.attributes.stop
        ? new Date(session.attributes.stop).getTime()
        : now.getTime();
      if (stop > sessionStart) onlineMs += (stop - sessionStart);
    }

    const uptime = (onlineMs / THIRTY_DAYS_MS) * 100;
    return Math.min(100, parseFloat(uptime.toFixed(1)));
  } catch {
    return null;
  }
}

async function buildCache() {
  if (isRefreshing) return;
  isRefreshing = true;
  console.log('Refreshing cache...');

  try {
    const serversData = await fetchServers();
    const servers = serversData.data || [];

    // Fetch uptime in parallel batches of 10
    const batchSize = 10;
    const uptimeMap = {};

    for (let i = 0; i < servers.length; i += batchSize) {
      const batch = servers.slice(i, i + batchSize);
      await Promise.all(batch.map(async s => {
        const uptime = await fetchUptime(s.id);
        uptimeMap[s.id] = uptime;
      }));
      if (i + batchSize < servers.length) {
        await new Promise(r => setTimeout(r, 500));
      }
    }

    serversData.data = servers.map(s => ({
      ...s,
      attributes: {
        ...s.attributes,
        uptimePct: uptimeMap[s.id]
      }
    }));

    cache = serversData;
    cacheTime = Date.now();
    console.log(`Cache refreshed. ${servers.length} servers processed.`);
  } catch (err) {
    console.error('Cache refresh failed:', err.message);
  } finally {
    isRefreshing = false;
  }
}

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET');
  next();
});

app.get('/', async (req, res) => {
  try {
    if (cache && cacheTime && (Date.now() - cacheTime < ONE_HOUR_MS)) {
      return res.json(cache);
    }
    if (!cache) {
      await buildCache();
      return res.json(cache || { data: [] });
    }
    res.json(cache);
    buildCache();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

buildCache();
setInterval(buildCache, ONE_HOUR_MS);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`DayZ proxy running on port ${PORT}`));
