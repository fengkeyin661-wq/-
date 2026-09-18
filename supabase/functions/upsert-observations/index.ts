// Supabase Edge: 批量写入观测并触发再评估（需配置 SUPABASE_SERVICE_ROLE_KEY）
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const body = await req.json();
    const { checkupId, observations, triggerEvent = 'observation_batch' } = body;
    if (!checkupId || !Array.isArray(observations) || !observations.length) {
      return new Response(JSON.stringify({ success: false, message: 'invalid payload' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: archive } = await supabase
      .from('health_archives')
      .select('id')
      .eq('checkup_id', checkupId)
      .maybeSingle();
    if (!archive) {
      return new Response(JSON.stringify({ success: false, message: 'archive not found' }), {
        status: 404,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const rows = observations.map((o: Record<string, unknown>) => ({
      archive_id: archive.id,
      checkup_id: checkupId,
      metric_code: o.metricCode,
      value_numeric: o.valueNumeric,
      value_text: String(o.valueNumeric ?? ''),
      unit: o.unit ?? null,
      observed_at: o.observedAt ?? new Date().toISOString(),
      source: o.source ?? triggerEvent,
      source_ref: o.sourceRef ?? null,
      entered_by_role: o.enteredByRole ?? null,
      status: 'active',
    }));

    const { data: inserted, error } = await supabase.from('health_observations').insert(rows).select('id');
    if (error) throw error;

    await supabase
      .from('health_archives')
      .update({ last_observation_at: new Date().toISOString(), recompute_status: 'pending' })
      .eq('checkup_id', checkupId);

    const recomputeUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/recompute-archive`;
    const recomputeRes = await fetch(recomputeUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ checkupId, triggerEvent }),
    });
    const recompute = await recomputeRes.json().catch(() => ({}));

    return new Response(
      JSON.stringify({ success: true, inserted: inserted?.length ?? rows.length, recompute }),
      { headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ success: false, message: String(e) }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});
