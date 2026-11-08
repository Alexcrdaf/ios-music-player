async function inspect() {
  const r = await fetch('https://mp3party.net/search?q=' + encodeURIComponent('Burial Forgive'), {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });
  const html = await r.text();
  const trackBlock = html.indexOf('track');
  console.log('Snippet:', html.slice(trackBlock, trackBlock + 800));
}
inspect();
