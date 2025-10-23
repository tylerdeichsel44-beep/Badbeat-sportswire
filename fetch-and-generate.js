import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateStoryFromGame } from './generator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ESPN_ENDPOINTS = {
  nfl: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
  nba: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',
  nhl: 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard',
  wnba: 'https://site.api.espn.com/apis/site/v2/sports/basketball/wnba/scoreboard',
  pga: 'https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard',
  cfb: 'https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard',
  cbb: 'https://site.api.espn.com/apis/site/v2/sports/basketball/college-basketball/scoreboard'
};

const MAX_GAMES_PER_LEAGUE = 50;
const LOG_PATH = path.join(__dirname, 'logs', 'fetch_log.json');

function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }

async function fetchJsonWithRetry(url, attempts=3, baseDelay=1000){
  let err;
  for(let i=0;i<attempts;i++){
    try{
      const res = await fetch(url, { headers: { 'User-Agent': 'badbeat-sportswire/1.0' } });
      if(!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    }catch(e){
      err = e;
      await sleep(baseDelay * Math.pow(2,i));
    }
  }
  throw err;
}

function ensureDirs(){
  ['data','posts','logs','public/games'].forEach(d=>{
    const p = path.join(__dirname, d);
    if(!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
  });
}

function slugify(s){
  return (s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
}

function neutralDate(iso){
  try{
    const d = new Date(iso);
    const opts = { year:'numeric', month:'short', day:'2-digit', hour:'numeric', minute:'2-digit' };
    return d.toLocaleString('en-US', opts);
  }catch{ return 'TBD'; }
}

function normalizeEspnGame(raw, leagueKey){
  try{
    const competition = raw.competitions && raw.competitions[0];
    const competitors = (competition && competition.competitors) || [];
    const homeObj = competitors.find(c=>c.homeAway==='home') || competitors[0] || {};
    const awayObj = competitors.find(c=>c.homeAway==='away') || competitors[1] || {};

    const game = {
      league: leagueKey,
      id: raw.id || (competition && competition.id) || 'unknown',
      home_team: (homeObj.team && (homeObj.team.displayName || homeObj.team.name)) || 'Home',
      away_team: (awayObj.team && (awayObj.team.displayName || awayObj.team.name)) || 'Away',
      status: raw.status && raw.status.type && raw.status.type.state || 'pre',
      start: (competition && competition.date) || raw.date || null,
      summary: (competition && competition.status && competition.status.type && competition.status.type.detail) || '',
      home_score: homeObj.score ?? null,
      away_score: awayObj.score ?? null,
      venue: (competition && competition.venue && competition.venue.fullName) || null,
      url: raw.links && raw.links.length ? raw.links[0].href : null,
      odds: (competition && competition.odds && competition.odds[0] && competition.odds[0].details) || null,
      source: 'ESPN'
    };
    return game;
  } catch(e){
    return null;
  }
}

function writeLog(entry){
  try{
    const list = fs.existsSync(LOG_PATH) ? JSON.parse(fs.readFileSync(LOG_PATH,'utf8')||'[]') : [];
    list.push({ ts: new Date().toISOString(), ...entry });
    fs.writeFileSync(LOG_PATH, JSON.stringify(list, null, 2));
  }catch{}
}

// Fallback placeholders (stubs)
async function googleFallback(leagueKey){
  // Intentionally minimal to avoid scraping brittleness in this starter pack.
  // Return an empty array, or implement your own parser here later.
  return [];
}

async function processLeague(leagueKey, url){
  let games = [];
  let ok = true;
  try{
    const j = await fetchJsonWithRetry(url);
    const events = j.events || j.items || j.games || [];
    for(const ev of events.slice(0, MAX_GAMES_PER_LEAGUE)){
      const ng = normalizeEspnGame(ev, leagueKey);
      if(ng) games.push(ng);
    }
  }catch(e){
    ok = false;
  }

  if(!ok || games.length === 0){
    // Attempt fallback
    const fallback = await googleFallback(leagueKey);
    if (fallback && fallback.length) games = fallback;
  }

  // Write league-day data
  const dateKey = new Date().toISOString().slice(0,10);
  const dataPath = path.join(__dirname, 'data', `${leagueKey}-${dateKey}.json`);
  fs.writeFileSync(dataPath, JSON.stringify(games, null, 2), 'utf8');

  // Generate posts
  for(const g of games){
    const md = generateStoryFromGame(g);
    const date = g.start ? new Date(g.start).toISOString().slice(0,10) : dateKey;
    const slug = `${date}-${slugify(g.away_team)}-at-${slugify(g.home_team)}-${leagueKey}`;
    const out = path.join(__dirname, 'posts', `${slug}.md`);
    fs.writeFileSync(out, md, 'utf8');
  }

  writeLog({ league: leagueKey, ok, count: games.length });
  await sleep(1200);
}

async function run(){
  ensureDirs();
  for(const [key, url] of Object.entries(ESPN_ENDPOINTS)){
    await processLeague(key, url);
  }
}

if (import.meta.url === `file://${process.argv[1]}`){
  run().catch(err=>{ console.error(err); process.exit(1); });
}
