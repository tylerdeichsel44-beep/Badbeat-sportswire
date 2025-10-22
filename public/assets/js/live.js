(function(){
  const tzElem = document.getElementById('bb-tz');
  if (tzElem) {
    try { tzElem.textContent = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local'; } catch { tzElem.textContent = 'Local'; }
  }
  function toLocal(iso){
    try { const d=new Date(iso); return d.toLocaleString([], { hour:'numeric', minute:'2-digit' }); }
    catch { return iso; }
  }
  document.querySelectorAll('.bb-time[data-iso]').forEach(el=>{
    const iso = el.getAttribute('data-iso'); if(iso) el.textContent = toLocal(iso);
  });

  const leagueMap = {
    nfl: 'football/nfl', nba: 'basketball/nba', nhl: 'hockey/nhl', wnba:'basketball/wnba',
    pga:'golf/pga', cfb:'football/college-football', cbb:'basketball/college-basketball'
  };
  async function fetchSummary(leagueKey, eventId){
    const path = leagueMap[leagueKey]; if(!path) return null;
    const url = `https://site.api.espn.com/apis/site/v2/sports/${path}/summary?event=${eventId}`;
    try{ const res=await fetch(url); if(!res.ok) return null; return await res.json(); }catch{return null;}
  }
  function formatScore(sum){
    try{
      const comp=sum?.boxscore?.teams||[]; if(comp.length!==2) return '—';
      const a=comp[0], b=comp[1];
      const an=a?.team?.displayName, bn=b?.team?.displayName;
      const as=a?.score, bs=b?.score;
      const status=sum?.header?.competitions?.[0]?.status?.type?.description||'';
      return `${an} ${as} — ${bn} ${bs} (${status})`;
    }catch{return '—'}
  }
  async function poll(container, leagueKey, eventId){
    const sum=await fetchSummary(leagueKey, eventId);
    if (sum){
      container.textContent = formatScore(sum);
      const state = sum?.header?.competitions?.[0]?.status?.type?.state || 'pre';
      if (state === 'post') return; // stop after final
    }
    setTimeout(()=>poll(container, leagueKey, eventId), 30000);
  }
  document.querySelectorAll('[data-score]').forEach(el=>{
    const tr = el.closest('[data-event-id]'); if(!tr) return;
    const eventId = tr.getAttribute('data-event-id'); const leagueKey = tr.getAttribute('data-league');
    if (eventId && leagueKey) poll(el, leagueKey, eventId);
  });
})();