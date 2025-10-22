import fs from 'fs';
import path from 'path';

function readTpl(n){ return fs.readFileSync(path.join('templates', n),'utf8'); }
function inject(tpl, data){
  let out = tpl;
  out = out.replace(/{{#GAMES}}([\s\S]*?){{\/GAMES}}/g, (_m,b)=> (data.GAMES||[]).map(r=> b.replace(/{{(\w+)}}/g, (_m2,k)=> String(r[k]??'') )).join(''));
  out = out.replace(/{{#HEADLINES}}([\s\S]*?){{\/HEADLINES}}/g, (_m,b)=> (data.HEADLINES||[]).map(r=> b.replace(/{{(\w+)}}/g, (_m2,k)=> String(r[k]??'') )).join(''));
  out = out.replace(/{{#EVENTS}}([\s\S]*?){{\/EVENTS}}/g, (_m,b)=> (data.EVENTS||[]).map(r=> b.replace(/{{(\w+)}}/g, (_m2,k)=> String(r[k]??'') )).join(''));
  out = out.replace(/{{#ROWS}}([\s\S]*?){{\/ROWS}}/g, (_m,b)=> (data.ROWS||[]).map(r=> b.replace(/{{(\w+)}}/g, (_m2,k)=> String(r[k]??'') )).join(''));
  out = out.replace(/{{#RECENT}}([\s\S]*?){{\/RECENT}}/g, (_m,b)=> (data.RECENT||[]).map(r=> b.replace(/{{(\w+)}}/g, (_m2,k)=> String(r[k]??'') )).join(''));
  out = out.replace(/{{#PLAYERS}}([\s\S]*?){{\/PLAYERS}}/g, (_m,b)=> (data.PLAYERS||[]).map(r=> b.replace(/{{(\w+)}}/g, (_m2,k)=> String(r[k]??'') )).join(''));
  out = out.replace(/{{(\w+)}}/g, (_m,k)=> String(data[k] ?? ''));
  return out;
}
function slugify(s){ return (s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,''); }
function header(){ return fs.readFileSync('templates/partials/header.html','utf8'); }
function neutralDate(iso){ try{ return new Date(iso).toLocaleDateString('en-US',{year:'numeric',month:'short',day:'2-digit'});}catch{return 'TBD';} }
function loadJSON(p, fb){ try{ return JSON.parse(fs.readFileSync(p,'utf8') || ''); }catch{ return fb; } }
function mdToHtml(md){ return md.split('\n').map(l=> l.startsWith('# ')? `<h1>${l.slice(2)}</h1>` : (l.trim()===''? '<p></p>': `<p>${l}</p>`)).join(''); }

function build(){
  if(!fs.existsSync('public')) fs.mkdirSync('public',{recursive:true});
  if(!fs.existsSync('public/games')) fs.mkdirSync('public/games',{recursive:true});
  if(!fs.existsSync('public/teams')) fs.mkdirSync('public/teams',{recursive:true});

  const YEAR = new Date().getFullYear();
  const dateKey = new Date().toISOString().slice(0,10);

  const indexTpl = readTpl('index-template.html');
  const leagueTpl = readTpl('league-template.html');
  const gameTpl = readTpl('game-template.html');
  const standingsTpl = readTpl('standings-template.html');
  const combatTpl = readTpl('combat-template.html');
  const teamTpl = readTpl('team-template.html');
  const assetsMap = loadJSON('data/assets-map.json', {});
  const teamLogos = loadJSON('data/team-logos.json', {});

  // headlines + game pages
  const posts = fs.existsSync('posts')? fs.readdirSync('posts').filter(f=>f.endsWith('.md')): [];
  const headlines = posts.slice(-12).reverse().map(f=>{
    const md = fs.readFileSync(path.join('posts',f),'utf8');
    const title = (md.split('\n')[0]||'').replace(/^# /,'');
    return { title, excerpt: 'Auto-generated match preview.', href: '/games/'+f.replace('.md','.html') };
  });
  for(const f of posts){
    const md = fs.readFileSync(path.join('posts',f),'utf8');
    const title = (md.split('\n')[0]||'').replace(/^# /,'');
    const leagueGuess = f.replace('.md','').split('-').pop();
    const html = inject(gameTpl, {
      HEADER_REL: header(),
      TITLE: title, BODY: mdToHtml(md), YEAR,
      startISO: '', start: '', venue: '', status: '',
      eventId: '', leagueKey: leagueGuess,
      PAGE_JSON: JSON.stringify({ kind:'game', league: leagueGuess })
    });
    fs.writeFileSync(path.join('public/games', f.replace('.md','.html')), html, 'utf8');
  }

  // league pages
  const leagues = [
    { key:'nfl', name:'NFL', out:'nfl.html' },
    { key:'nba', name:'NBA', out:'nba.html' },
    { key:'nhl', name:'NHL', out:'nhl.html' },
    { key:'wnba', name:'WNBA', out:'wnba.html' },
    { key:'pga', name:'PGA', out:'pga.html' },
    { key:'cfb', name:'College Football', out:'cfb.html' },
    { key:'cbb', name:'College Basketball', out:'cbb-men.html' }
  ];
  for(const lg of leagues){
    const file = `data/${lg.key}-${dateKey}.json`; let games = [];
    if(fs.existsSync(file)){ try{ games = JSON.parse(fs.readFileSync(file,'utf8') || '[]'); }catch{ games=[]; } }
    const rows = games.map(g=>{
      const iso = g.start || ''; const time = iso ? new Date(iso).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}) : 'TBD';
      const awaySlug = slugify(g.away_team), homeSlug = slugify(g.home_team);
      const discovered = teamLogos[lg.key] || {};
      const awayLogo = discovered[g.away_team] || (assetsMap[lg.key]?.[g.away_team]?.logo) || '/assets/placeholder-logo.png';
      const homeLogo = discovered[g.home_team] || (assetsMap[lg.key]?.[g.home_team]?.logo) || '/assets/placeholder-logo.png';
      const slugpage = `${dateKey}-${awaySlug}-at-${homeSlug}-${lg.key}.html`;
      return { iso, time, away:g.away_team, home:g.home_team, odds:g.odds||'—', slug: slugpage, awayLogo, homeLogo, awaySlug, homeSlug, leagueKey: lg.key, eventId:g.eventId||'' };
    });
    const html = inject(leagueTpl, { HEADER: header(), LEAGUE: lg.name, DATE: neutralDate(dateKey), YEAR, GAMES: rows, PAGE_JSON: JSON.stringify({kind:'league',league:lg.key,count:rows.length}) });
    fs.writeFileSync(path.join('public', lg.out), html, 'utf8');
  }

  // standings pages
  const st = [
    { k:'nfl', name:'NFL', out:'standings-nfl.html' },
    { k:'nba', name:'NBA', out:'standings-nba.html' },
    { k:'nhl', name:'NHL', out:'standings-nhl.html' },
    { k:'wnba', name:'WNBA', out:'standings-wnba.html' },
    { k:'cfb', name:'CFB', out:'standings-cfb.html' },
    { k:'cbb', name:'CBB Men', out:'standings-cbb-men.html' }
  ];
  for(const sp of st){
    const key = sp.k;
    const file = `data/standings-${key}-${dateKey}.json`; let rows = [];
    if(fs.existsSync(file)){ try{ rows = JSON.parse(fs.readFileSync(file,'utf8') || '[]'); }catch{ rows=[]; } }
    const html = inject(standingsTpl, { HEADER: header(), LEAGUE: sp.name, DATE: neutralDate(dateKey), YEAR, ROWS: rows, PAGE_JSON: JSON.stringify({kind:'standings',league:key}) });
    fs.writeFileSync(path.join('public', sp.out), html, 'utf8');
  }

  // combat pages
  for(const k of ['ufc','boxing']){
    const file = `data/${k}-${dateKey}.json`; let events = [];
    if(fs.existsSync(file)){ try{ events = JSON.parse(fs.readFileSync(file,'utf8') || '[]'); }catch{ events=[]; } }
    const html = inject(combatTpl, { HEADER: header(), TITLE: k.toUpperCase(), EVENTS: events, YEAR, PAGE_JSON: JSON.stringify({kind:'combat',league:k}) });
    fs.writeFileSync(path.join('public', `${k}.html`), html, 'utf8');
  }

  // team pages (basic players grid placeholder; prefill script will fill real URLs)
  const teamsByLeague = loadJSON('data/teams-by-league.json', {});
  for(const [leagueKey, teamList] of Object.entries(teamsByLeague)){
    for(const teamName of teamList){
      const discovered = teamLogos[leagueKey] || {};
      const logo = discovered[teamName] || (assetsMap[leagueKey]?.[teamName]?.logo) || '/assets/placeholder-logo.png';
      const players = [];
      const playerMap = (assetsMap[leagueKey]?.[teamName]?.players) || {};
      for(const [name, url] of Object.entries(playerMap)){
        if(name==='defaultBase') continue;
        players.push({ name, pos:'', photo:url });
      }
      if(players.length===0){ players.push({ name:'Player One', pos:'', photo:'/assets/placeholder-headshot.png' }); }
      const html = inject(teamTpl, { HEADER: header(), TEAM: teamName, LEAGUE: leagueKey.toUpperCase(), YEAR, logo,
                                     RECENT: [], PLAYERS: players,
                                     PAGE_JSON: JSON.stringify({kind:'team',league:leagueKey,team:teamName}) });
      const outDir = path.join('public','teams',leagueKey); if(!fs.existsSync(outDir)) fs.mkdirSync(outDir,{recursive:true});
      fs.writeFileSync(path.join(outDir, slugify(teamName)+'.html'), html, 'utf8');
    }
  }

  // index
  const idx = inject(indexTpl, { HEADER: header(), YEAR, HEADLINES: headlines, PAGE_JSON: JSON.stringify({ kind:'home' }) });
  fs.writeFileSync('public/index.html', idx, 'utf8');
}
build();
