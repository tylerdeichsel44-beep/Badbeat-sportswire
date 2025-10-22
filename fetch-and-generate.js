import fs from 'fs';

const SCOREBOARDS = {
  nfl: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
  nba: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',
  nhl: 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard',
  wnba:'https://site.api.espn.com/apis/site/v2/sports/basketball/wnba/scoreboard',
  pga: 'https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard',
  cfb: 'https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard',
  cbb: 'https://site.api.espn.com/apis/site/v2/sports/basketball/college-basketball/scoreboard'
};
const STANDINGS = {
  nfl: 'https://site.web.api.espn.com/apis/common/v3/sports/football/nfl/standings',
  nba: 'https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/standings',
  nhl: 'https://site.web.api.espn.com/apis/common/v3/sports/hockey/nhl/standings',
  wnba:'https://site.web.api.espn.com/apis/common/v3/sports/basketball/wnba/standings',
  cfb: 'https://site.web.api.espn.com/apis/common/v3/sports/football/college-football/standings',
  cbb: 'https://site.web.api.espn.com/apis/common/v3/sports/basketball/college-basketball/standings'
};
const COMBAT = {
  ufc: 'https://site.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard',
  boxing: 'https://site.api.espn.com/apis/site/v2/sports/boxing/professional/scoreboard'
};

const MAX = 50;
const delay = (ms)=> new Promise(r=>setTimeout(r, ms));

async function getJson(url, tries=3){
  let last;
  for(let i=0;i<tries;i++){
    try{
      const res = await fetch(url, { headers: { 'User-Agent': 'badbeat-sportswire/7.0' } });
      if(!res.ok) throw new Error('HTTP '+res.status);
      return await res.json();
    }catch(e){ last=e; await delay(800*Math.pow(2,i)); }
  }
  throw last;
}

function slug(s){ return (s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,''); }

function normalizeEvent(ev, league, logoStore){
  try{
    const comp = ev.competitions?.[0];
    const comps = comp?.competitors || [];
    const home = comps.find(c=>c.homeAway==='home') || comps[0] || {};
    const away = comps.find(c=>c.homeAway==='away') || comps[1] || {};
    const homeName = home.team?.displayName || home.team?.name || 'Home';
    const awayName = away.team?.displayName || away.team?.name || 'Away';
    const homeLogo = (home.team?.logo) || (home.team?.logos?.[0]?.href);
    const awayLogo = (away.team?.logo) || (away.team?.logos?.[0]?.href);
    if(homeLogo){ (logoStore[league] ||= {})[homeName] = homeLogo; }
    if(awayLogo){ (logoStore[league] ||= {})[awayName] = awayLogo; }
    return {
      league,
      eventId: ev.id || comp?.id || '',
      home_team: homeName,
      away_team: awayName,
      status: ev.status?.type?.state || 'pre',
      start: comp?.date || ev.date || null,
      summary: comp?.status?.type?.detail || '',
      home_score: home.score ?? null,
      away_score: away.score ?? null,
      venue: comp?.venue?.fullName || null,
      url: ev.links?.[0]?.href || null,
      odds: comp?.odds?.[0]?.details || null,
      source: 'ESPN'
    };
  } catch { return null; }
}

function story(g){
  const home = g.home_team, away = g.away_team;
  const start = g.start ? new Date(g.start).toLocaleString('en-US',{year:'numeric',month:'short',day:'2-digit',hour:'numeric',minute:'2-digit'}) : 'TBD';
  const status = g.status || 'pre';
  const venue = g.venue || 'TBD';
  const odds = g.odds || '—';
  const statusLine = status==='in' ? `Live: ${away} ${g.away_score ?? '-'} — ${home} ${g.home_score ?? '-'}.`
                     : status==='post' ? `Final: ${away} ${g.away_score ?? '-'} — ${home} ${g.home_score ?? '-'}.`
                     : `Pre-game: ${g.summary || 'No additional status.'}`;
  return `# ${away} at ${home} (${g.league.toUpperCase()})
**Start:** ${start}  \\n**Venue:** ${venue}  \\n**Status:** ${status}
**Odds snapshot:** ${odds}

${away} travels to face ${home}. Both teams arrive with evolving form and matchup-specific wrinkles to watch.

${statusLine}

_This summary is auto-generated from public scoreboard data for informational purposes only (not betting advice). Source: ${g.source}._`;
}

function extractStandings(raw){
  const rows = [];
  try{
    const entries = raw?.children?.[0]?.standings?.entries || raw?.standings?.entries || [];
    for(const e of entries){
      const team = e?.team?.displayName || e?.team?.name || 'Team';
      const stats = Object.fromEntries((e?.stats||[]).map(s=>[s.name, s.value]));
      const w = stats.wins ?? stats.w ?? 0;
      const l = stats.losses ?? stats.l ?? 0;
      const pct = stats.winPercent ?? stats.pct ?? (w||l ? (w/((w||0)+(l||0))).toFixed(3) : 0);
      const gb = stats.gamesBack ?? stats.gb ?? '';
      rows.push({ team, w, l, pct, gb });
    }
  }catch{}
  return rows;
}

async function run(){
  ['data','posts','logs','public/games','public/teams'].forEach(d=>{ if(!fs.existsSync(d)) fs.mkdirSync(d,{recursive:true}); });
  const dateKey = new Date().toISOString().slice(0,10);

  const teamsByLeague = {}; const teamLogos = {};

  // Leagues: games + posts + logo harvest
  for(const [key,url] of Object.entries(SCOREBOARDS)){
    let games = [];
    try{
      const j = await getJson(url);
      const events = j.events || j.items || j.games || [];
      games = events.slice(0,MAX).map(e=>normalizeEvent(e,key,teamLogos)).filter(Boolean);
    }catch{ games = []; }
    fs.writeFileSync(`data/${key}-${dateKey}.json`, JSON.stringify(games,null,2));

    const set = new Set();
    for(const g of games){
      const s = `${dateKey}-${slug(g.away_team)}-at-${slug(g.home_team)}-${key}`;
      fs.writeFileSync(`posts/${s}.md`, story(g));
      set.add(g.home_team); set.add(g.away_team);
    }
    teamsByLeague[key] = Array.from(set);
    await delay(300);
  }

  // Standings
  for(const [k,u] of Object.entries(STANDINGS)){
    try{
      const raw = await getJson(u);
      fs.writeFileSync(`data/standings-${k}-${dateKey}.json`, JSON.stringify(extractStandings(raw), null, 2));
    }catch{
      fs.writeFileSync(`data/standings-${k}-${dateKey}.json`, JSON.stringify([], null, 2));
    }
    await delay(200);
  }

  // Combat
  for(const [k,u] of Object.entries(COMBAT)){
    try{
      const raw = await getJson(u);
      const events = (raw?.events||[]).map(ev=> ({
        iso: ev?.date || '',
        date: ev?.date || '',
        match: ev?.name || ev?.shortName || 'Event',
        loc: ev?.competitions?.[0]?.venue?.fullName || '',
        href: ev?.links?.[0]?.href || '#'
      }));
      fs.writeFileSync(`data/${k}-${dateKey}.json`, JSON.stringify(events, null, 2));
    }catch{
      fs.writeFileSync(`data/${k}-${dateKey}.json`, JSON.stringify([], null, 2));
    }
    await delay(200);
  }

  // Persist helpers
  fs.writeFileSync('data/teams-by-league.json', JSON.stringify(teamsByLeague, null, 2));
  fs.writeFileSync('data/team-logos.json', JSON.stringify(teamLogos, null, 2));

  // Ensure a post exists
  const posts = fs.readdirSync('posts').filter(f=>f.endsWith('.md'));
  if(posts.length===0){
    fs.writeFileSync('posts/placeholder.md', '# No games found\\n\\nContent will populate on the next run.');
  }
}
run().catch(e=>{ console.error(e); process.exit(1); });
