const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanup() {
  console.log('=== Cleaning up fake data ===\n');

  // 1. Delete transactions without tx_hash
  const { data: badTxs, error: fetchErr } = await supabase
    .from('transactions')
    .select('id')
    .or('tx_hash.is.null,tx_hash.eq.\"\")');
  
  if (fetchErr) {
    console.error('Fetch error:', fetchErr.message);
  } else {
    console.log(`Found ${badTxs?.length || 0} transactions without tx_hash`);
    
    if (badTxs && badTxs.length > 0) {
      const { error: delErr } = await supabase
        .from('transactions')
        .delete()
        .or('tx_hash.is.null,tx_hash.eq.\"\")');
      
      if (delErr) {
        console.error('Delete error:', delErr.message);
      } else {
        console.log(`Deleted ${badTxs.length} fake transactions`);
      }
    }
  }

  // 2. Delete old payment_received notifications (> 1 hour)
  const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
  const { data: oldNotifs, error: notifFetchErr } = await supabase
    .from('notifications')
    .select('id')
    .lt('created_at', oneHourAgo)
    .eq('type', 'payment_received');
  
  if (notifFetchErr) {
    console.error('Notification fetch error:', notifFetchErr.message);
  } else {
    console.log(`Found ${oldNotifs?.length || 0} old payment_received notifications`);
    
    if (oldNotifs && oldNotifs.length > 0) {
      const { error: delNotifErr } = await supabase
        .from('notifications')
        .delete()
        .lt('created_at', oneHourAgo)
        .eq('type', 'payment_received');
      
      if (delNotifErr) {
        console.error('Notification delete error:', delNotifErr.message);
      } else {
        console.log(`Deleted ${oldNotifs.length} old notifications`);
      }
    }
  }

  console.log('\n=== Cleanup complete ===');
}

cleanup().catch(console.error);
