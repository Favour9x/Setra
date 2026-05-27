const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanup() {
  console.log('=== Deleting ALL transactions ===\n');

  const { data: txs, error: fetchErr, count } = await supabase
    .from('transactions')
    .select('id', { count: 'exact' });

  if (fetchErr) {
    console.error('Fetch error:', fetchErr.message);
    process.exit(1);
  }

  console.log(`Found ${count || 0} total transactions to delete`);

  if (txs && txs.length > 0) {
    // Delete in batches to avoid URL length limits
    const batchSize = 500;
    for (let i = 0; i < txs.length; i += batchSize) {
      const batch = txs.slice(i, i + batchSize).map(t => t.id);
      const { error: delErr } = await supabase
        .from('transactions')
        .delete()
        .in('id', batch);

      if (delErr) {
        console.error(`Batch delete error at offset ${i}:`, delErr.message);
      } else {
        console.log(`Deleted batch ${Math.floor(i / batchSize) + 1} (${batch.length} records)`);
      }
    }
  }

  // Also delete all notifications
  const { data: notifs, error: notifFetchErr, count: notifCount } = await supabase
    .from('notifications')
    .select('id', { count: 'exact' });

  if (notifFetchErr) {
    console.error('Notifications fetch error:', notifFetchErr.message);
  } else {
    console.log(`\nFound ${notifCount || 0} total notifications to delete`);

    if (notifs && notifs.length > 0) {
      const batchSize = 500;
      for (let i = 0; i < notifs.length; i += batchSize) {
        const batch = notifs.slice(i, i + batchSize).map(n => n.id);
        const { error: delErr } = await supabase
          .from('notifications')
          .delete()
          .in('id', batch);

        if (delErr) {
          console.error(`Batch delete error at offset ${i}:`, delErr.message);
        } else {
          console.log(`Deleted batch ${Math.floor(i / batchSize) + 1} (${batch.length} records)`);
        }
      }
    }
  }

  console.log('\n=== All transactions and notifications deleted ===');
}

cleanup().catch(console.error);
