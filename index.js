const express = require('express');
const fetch = require('node-fetch');
const app = express();

const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbiI6ImVjYzUyMzcyYWNmYzlkZTYiLCJpYXQiOjE3NzgzMjkwODcsIm5iZiI6MTc3ODMyOTA4NywiaXNzIjoiaHR0cHM6Ly93d3cuYmF0dGxlbWV0cmljcy5jb20iLCJzdWIiOiJ1cm46dXNlcjoxMTkyMDk5In0.2-TUDkH6J4_av5dwU73XdalD8JzMMtiOXsJ0edQCSbM';

app.get('/', async (req, res) => {
  try {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET');
    const url = 'https://api.battlemetrics.com/servers?filter[game]=dayz&sort=-players&page[size]=100';
    const r = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Accept': 'application/json'
      }
    });
    if (!r.ok) {
      return res.status(502).json({ error: r.status, message: await r.text() });
    }
    const data = await r.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`DayZ proxy running on port ${PORT}`));
