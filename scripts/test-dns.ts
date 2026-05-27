async function query(type: string) {
  const url = `https://cloudflare-dns.com/dns-query?name=db.jdoagvioqvypiyvmgjwn.supabase.co&type=${type}`;
  try {
    const res = await fetch(url, {
      headers: { "accept": "application/dns-json" }
    });
    const data = await res.json();
    console.log(`DNS (${type}) response:`, JSON.stringify(data, null, 2));
  } catch (err: any) {
    console.error(`Failed to fetch DNS (${type}):`, err.message);
  }
}

async function main() {
  await query("CNAME");
  await query("A");
  await query("AAAA");
}
main();
