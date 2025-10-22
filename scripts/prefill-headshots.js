import fs from 'fs';

const NFL_ROSTERS = {
  "Arizona Cardinals": "https://www.azcardinals.com/team/players-roster/",
  "Atlanta Falcons": "https://www.atlantafalcons.com/team/players-roster/",
  "Baltimore Ravens": "https://www.baltimoreravens.com/team/players-roster/",
  "Buffalo Bills": "https://www.buffalobills.com/team/players-roster/",
  "Carolina Panthers": "https://www.panthers.com/team/players-roster/",
  "Chicago Bears": "https://www.chicagobears.com/team/players-roster/",
  "Cincinnati Bengals": "https://www.bengals.com/team/players-roster/",
  "Cleveland Browns": "https://www.clevelandbrowns.com/team/players-roster/",
  "Dallas Cowboys": "https://www.dallascowboys.com/team/players-roster/",
  "Denver Broncos": "https://www.denverbroncos.com/team/players-roster/",
  "Detroit Lions": "https://www.detroitlions.com/team/players-roster/",
  "Green Bay Packers": "https://www.packers.com/team/players-roster/",
  "Houston Texans": "https://www.houstontexans.com/team/players-roster/",
  "Indianapolis Colts": "https://www.colts.com/team/players-roster/",
  "Jacksonville Jaguars": "https://www.jaguars.com/team/players-roster/",
  "Kansas City Chiefs": "https://www.chiefs.com/team/players-roster/",
  "Las Vegas Raiders": "https://www.raiders.com/team/players-roster/",
  "Los Angeles Chargers": "https://www.chargers.com/team/players-roster/",
  "Los Angeles Rams": "https://www.therams.com/team/players-roster/",
  "Miami Dolphins": "https://www.miamidolphins.com/team/players-roster/",
  "Minnesota Vikings": "https://www.vikings.com/team/players-roster/",
  "New England Patriots": "https://www.patriots.com/team/players-roster/",
  "New Orleans Saints": "https://www.neworleanssaints.com/team/players-roster/",
  "New York Giants": "https://www.giants.com/team/players-roster/",
  "New York Jets": "https://www.newyorkjets.com/team/players-roster/",
  "Philadelphia Eagles": "https://www.philadelphiaeagles.com/team/players-roster/",
  "Pittsburgh Steelers": "https://www.steelers.com/team/players-roster/",
  "San Francisco 49ers": "https://www.49ers.com/team/players-roster/",
  "Seattle Seahawks": "https://www.seahawks.com/team/players-roster/",
  "Tampa Bay Buccaneers": "https://www.buccaneers.com/team/players-roster/",
  "Tennessee Titans": "https://www.tennesseetitans.com/team/players-roster/",
  "Washington Commanders": "https://www.commanders.com/team/players-roster/"
};

const NBA_ROSTERS = {
  "Atlanta Hawks": "https://www.nba.com/hawks/roster",
  "Boston Celtics": "https://www.nba.com/celtics/roster",
  "Brooklyn Nets": "https://www.nba.com/nets/roster",
  "Charlotte Hornets": "https://www.nba.com/hornets/roster",
  "Chicago Bulls": "https://www.nba.com/bulls/roster",
  "Cleveland Cavaliers": "https://www.nba.com/cavaliers/roster",
  "Dallas Mavericks": "https://www.nba.com/mavericks/roster",
  "Denver Nuggets": "https://www.nba.com/nuggets/roster",
  "Detroit Pistons": "https://www.nba.com/pistons/roster",
  "Golden State Warriors": "https://www.nba.com/warriors/roster",
  "Houston Rockets": "https://www.nba.com/rockets/roster",
  "Indiana Pacers": "https://www.nba.com/pacers/roster",
  "LA Clippers": "https://www.nba.com/clippers/roster",
  "Los Angeles Lakers": "https://www.nba.com/lakers/roster",
  "Memphis Grizzlies": "https://www.nba.com/grizzlies/roster",
  "Miami Heat": "https://www.nba.com/heat/roster",
  "Milwaukee Bucks": "https://www.nba.com/bucks/roster",
  "Minnesota Timberwolves": "https://www.nba.com/timberwolves/roster",
  "New Orleans Pelicans": "https://www.nba.com/pelicans/roster",
  "New York Knicks": "https://www.nba.com/knicks/roster",
  "Oklahoma City Thunder": "https://www.nba.com/thunder/roster",
  "Orlando Magic": "https://www.nba.com/magic/roster",
  "Philadelphia 76ers": "https://www.nba.com/sixers/roster",
  "Phoenix Suns": "https://www.nba.com/suns/roster",
  "Portland Trail Blazers": "https://www.nba.com/blazers/roster",
  "Sacramento Kings": "https://www.nba.com/kings/roster",
  "San Antonio Spurs": "https://www.nba.com/spurs/roster",
  "Toronto Raptors": "https://www.nba.com/raptors/roster",
  "Utah Jazz": "https://www.nba.com/jazz/roster",
  "Washington Wizards": "https://www.nba.com/wizards/roster"
};

function sameOrigin(url, page){
  try{
    const u=new URL(url, page); const p=new URL(page);
    return u.origin===p.origin ? u.href : null;
  }catch{ return null; }
}

async function fetchText(url){ try{ const r=await fetch(url,{headers:{'User-Agent':'badbeat-prefill/2.0'}}); if(!r.ok) return ''; return await r.text(); }catch{ return ''; } }

function extractImages(html, pageUrl){
  const imgs=[];
  const re=/<img[^>]+src=["']([^"']+)["'][^>]*alt=["']([^"']+)["'][^>]*>/gi;
  let m; while((m=re.exec(html))){ const src=m[1]; const alt=m[2]; const so=sameOrigin(src, pageUrl); if(so){ imgs.push({src:so, alt}); } }
  return imgs;
}

function updateMap(map, leagueKey, team, imgList){
  map[leagueKey] ||= {}; map[leagueKey][team] ||= { logo:"/assets/placeholder-logo.png", players:{} };
  const players = map[leagueKey][team].players;
  for(const im of imgList){
    const clean = im.alt.replace(/\s+\d+.*/,'').replace(/\s+\(.+\)/,'').trim();
    if(clean.split(' ').length>=2 && !players[clean]) players[clean]=im.src;
  }
}

async function run(){
  const mapPath='data/assets-map.json'; let assets={};
  try{ assets=JSON.parse(fs.readFileSync(mapPath,'utf8')); }catch{ assets={}; }
  assets.nfl ||= {}; assets.nba ||= {};

  for(const [team,url] of Object.entries(NFL_ROSTERS)){
    const html=await fetchText(url);
    const imgs=extractImages(html,url);
    updateMap(assets,'nfl',team,imgs);
    await new Promise(r=>setTimeout(r,300));
  }
  for(const [team,url] of Object.entries(NBA_ROSTERS)){
    const html=await fetchText(url);
    const imgs=extractImages(html,url);
    updateMap(assets,'nba',team,imgs);
    await new Promise(r=>setTimeout(r,300));
  }

  fs.writeFileSync(mapPath, JSON.stringify(assets,null,2));
  console.log('Prefill complete.');
}
run().catch(e=>{ console.error(e); process.exit(1); });
