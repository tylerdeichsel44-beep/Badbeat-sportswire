export function generateStoryFromGame(game){
  const home = game.home_team || 'Home Team';
  const away = game.away_team || 'Away Team';
  const kickoff = game.start ? new Date(game.start).toLocaleString('en-US', {year:'numeric',month:'short',day:'2-digit',hour:'numeric',minute:'2-digit'}) : 'TBD';
  const status = game.status || 'pre';
  const venue = game.venue || 'TBD';
  const odds = game.odds || 'N/A';
  const source = game.source || 'Unknown';

  const pick = (a)=>a[Math.floor(Math.random()*a.length)];
  const openers = [
    `The upcoming matchup between ${away} and ${home} is scheduled for ${kickoff}.`,
    `${away} will meet ${home} on ${kickoff} in ${game.league?.toUpperCase()||'league'} action.`,
    `${away} travels to face ${home}, with a scheduled start of ${kickoff}.`
  ];
  const contexts = [
    `${away} brings recent form while ${home} focuses on consistency.`,
    `Both sides arrive with balanced strengths and emerging storylines.`,
    `Injury reports and lineup notes remain in flux as both teams prepare.`
  ];
  const statusLine = (status === 'in')
    ? `Live update: ${away} ${game.away_score ?? '-'} — ${home} ${game.home_score ?? '-'}.`
    : (status === 'post'
      ? `Final: ${away} ${game.away_score ?? '-'} — ${home} ${game.home_score ?? '-'}.`
      : `Pre-match status: ${game.summary || 'No additional status at this time.'}`);

  const body = [
    pick(openers),
    pick(contexts),
    statusLine,
    `This summary is generated automatically from public scoreboard data. It is for informational purposes only and not betting advice.`
  ].join('\n\n');

  const md = `# ${away} at ${home} (${game.league?.toUpperCase()||''})\n\n` +
             `**Start:** ${kickoff}  \n**Venue:** ${venue}  \n**Status:** ${status}  \n\n` +
             `**Odds snapshot:** ${odds}  \n\n` +
             body + `\n\n_Source: ${source}._`;
  return md;
}
