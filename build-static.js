import fs from 'fs';
import path from 'path';

function mdToHtml(md){
  const lines = md.split('\n');
  let out = '';
  for(const line of lines){
    if(line.startsWith('# ')) out += `<h1>${line.slice(2)}</h1>`;
    else if(line.startsWith('**')) {
      // naive handling of bold lines
      out += `<p><strong>${line.replace(/\*\*/g,'')}</strong></p>`;
    } else if(line.trim()==='') {
      out += '<p></p>';
    } else {
      out += `<p>${line}</p>`;
    }
  }
  return out;
}

function readTemplate(name){
  return fs.readFileSync(path.join('templates', name), 'utf8');
}

function inject(template, data){
  // Very small templating: replace {{KEY}} and repeat blocks {{#GAMES}}...{{/GAMES}}, {{#HEADLINES}}...{{/HEADLINES}}
  let out = template.replace(/{{(\w+)}}/g, (_,k)=> (data[k] ?? ''));
  // handle GAMES block
  out = out.replace(/{{#GAMES}}([\s\S]*?){{\/GAMES}}/g, (_,block)=>{
    const arr = data.GAMES || [];
    return arr.map(row=> block.replace(/{{(\w+)}}/g, (__,k)=> (row[k] ?? ''))).join('');
  });
  // handle HEADLINES block
  out = out.replace(/{{#HEADLINES}}([\s\S]*?){{\/HEADLINES}}/g, (_,block)=>{
    const arr = data.HEADLINES || [];
    return arr.map(row=> block.replace(/{{(\w+)}}/g, (__,k)=> (row[k] ?? ''))).join('');
  });
  return out;
}

function slugify(s){
  return (s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
}

function neutralDate(iso){
  try{
    const d = new Date(iso);
    const opts = { year:'numeric', month:'short', day:'2-digit' };
    return d.toLocaleDateString('en-US', opts);
  }catch{ return 'TBD'; }
}

function build(){
  if(!fs.existsSync('public')) fs.mkdirSync('public', { recursive: true });
  if(!fs.existsSync('public/games')) fs.mkdirSync('public/games', { recursive: true });

  const year = new Date().getFullYear();
  const indexTpl = readTemplate('index-template.html');
  const leagueTpl = readTemplate('league-template.html');
  const gameTpl = readTemplate('game-template.html');

  // Gather posts and headlines
  const posts = fs.existsSync('posts') ? fs.readdirSync('posts').filter(f=>f.endsWith('.md')) : [];
  const headlines = posts.slice(-12).reverse().map(f=>{
    const md = fs.readFileSync(path.join('posts',f),'utf8');
    const titleLine = (md.split('\n')[0] || '').replace(/^# /,'');
    const date = neutralDate(f.split('-')[0] || new Date().toISOString());
    const href = 'games/' + f.replace('.md','.html');
    return { title: titleLine, excerpt: 'Auto-generated match preview.', href, date };
  });

  // Build game pages
  for(const f of posts){
    const md = fs.readFileSync(path.join('posts',f),'utf8');
    const htmlBody = mdToHtml(md);
    const title = (md.split('\n')[0] || '').replace(/^# /,'');
    const page = gameTpl
      .replace(/{{TITLE}}/g, title)
      .replace(/{{BODY}}/g, htmlBody)
      .replace(/{{YEAR}}/g, String(year))
      .replace(/{{start}}/g, '')
      .replace(/{{venue}}/g, '')
      .replace(/{{status}}/g, '')
      .replace(/{{odds}}/g, '')
      .replace(/{{source}}/g, 'ESPN')
      .replace(/{{source_link}}/g, '#');

    fs.writeFileSync(path.join('public/games', f.replace('.md','.html')), page, 'utf8');
  }

  // Build league pages from data/*.json
  const leagues = [
    { key:'nfl', name:'NFL' },
    { key:'nba', name:'NBA' },
    { key:'nhl', name:'NHL' },
    { key:'wnba', name:'WNBA' },
    { key:'pga', name:'PGA' },
    { key:'cfb', name:'College Football' },
    { key:'cbb', name:"College Basketball" }
  ];

  const dateKey = new Date().toISOString().slice(0,10);
  leagues.forEach(lg=>{
    const dataFile = `data/${lg.key}-${dateKey}.json`;
    let games = [];
    if (fs.existsSync(dataFile)){
      games = JSON.parse(fs.readFileSync(dataFile,'utf8'));
    }

    const rows = games.map(g=>{
      const time = g.start ? new Date(g.start).toLocaleTimeString('en-US', {hour:'numeric', minute:'2-digit'}) : 'TBD';
      const odds = g.odds || '—';
      const slug = `${dateKey}-${slugify(g.away_team)}-at-${slugify(g.home_team)}-${lg.key}` + '.html';
      return { time, away: g.away_team, home: g.home_team, odds, slug };
    });

    const html = inject(leagueTpl, { LEAGUE: lg.name, DATE: neutralDate(dateKey), YEAR: year, GAMES: rows });
    fs.writeFileSync(path.join('public', (lg.key === 'cfb' ? 'cfb' : (lg.key === 'cbb' ? 'cbb-men' : lg.key)) + '.html'), html, 'utf8');
  });

  // Build index
  const indexHtml = inject(indexTpl, { YEAR: year, HEADLINES: headlines });
  fs.writeFileSync('public/index.html', indexHtml, 'utf8');

  // Build log
  const buildLogPath = path.join('logs', 'build_log.json');
  const entry = { ts: new Date().toISOString(), pages: posts.length, leagues: leagues.length };
  const prev = fs.existsSync(buildLogPath) ? JSON.parse(fs.readFileSync(buildLogPath,'utf8') or '[]') : [];
  prev.append(entry) if False else None
  # Python-esque safeguard; we'll just write current entry list properly:
  try:
    lst = json.loads(open(buildLogPath).read()) if os.path.exists(buildLogPath) else []
  except Exception:
    lst = []
  lst.append(entry)
  open(buildLogPath, "w").write(JSON.stringify(lst, indent=2))
}

build();
