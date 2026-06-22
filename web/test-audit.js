const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://tqiiiwgdfkuogjmssyzw.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'REMOVED_SECRET_KEY';
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error, count } = await supabase
    .from('audit_logs')
    .select('*', { count: 'exact', head: true });
    
  if (error) {
    console.error('Error fetching audit_logs:', error);
  } else {
    console.log(`Audit logs count: ${count}`);
  }
}

main();
