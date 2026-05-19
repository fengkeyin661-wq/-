// Supabase Edge: 再评估占位 — 生产环境应调用完整 materialize + AI 流水线
// 当前实现：标记 assessment_run 并更新 recompute_status，详细逻辑由前端 recomputeArchiveService 兜底
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const { checkupId, triggerEvent = 'manual', publishMode = 'draft' } = await req.json();
    if (!checkupId) {
      return new Response(JSON.stringify({ success: false, message: 'checkupId required' }), {
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
      .select('id, health_record, assessment_data')
      .eq('checkup_id', checkupId)
      .maybeSingle();
    if (!archive) {
      return new Response(JSON.stringify({ success: false, message: 'archive not found' }), {
        status: 404,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const { data: run } = await supabase
      .from('health_assessment_runs')
      .insert({
        archive_id: archive.id,
        checkup_id: checkupId,
        trigger_event: triggerEvent,
        status: 'running',
        publish_mode: publishMode,
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    await supabase
      .from('health_archives')
      .update({
        recompute_status: 'running',
        current_assessment_run_id: run?.id ?? null,
      })
      .eq('checkup_id', checkupId);

    // 拉取最新观测写回 health_record 快照（简化 materialize）
    const { data: obs } = await supabase
      .from('health_observations')
      .select('metric_code, value_numeric, observed_at')
      .eq('checkup_id', checkupId)
      .eq('status', 'active')
      .order('observed_at', { ascending: false });

    const record = { ...(archive.health_record as Record<string, unknown>) };
    const checkup = (record.checkup as Record<string, unknown>) || {};
    const basics = (checkup.basics as Record<string, unknown>) || {};
    const labBasic = (checkup.labBasic as Record<string, unknown>) || {};
    const lipids = (labBasic.lipids as Record<string, unknown>) || {};
    const glucose = (labBasic.glucose as Record<string, unknown>) || {};
    const seen = new Set<string>();
    for (const row of obs || []) {
      if (seen.has(row.metric_code)) continue;
      seen.add(row.metric_code);
      const v = row.value_numeric;
      if (v == null) continue;
      switch (row.metric_code) {
        case 'core.sbp':
          basics.sbp = v;
          break;
        case 'core.dbp':
          basics.dbp = v;
          break;
        case 'core.weight':
          basics.weight = v;
          break;
        case 'core.bmi':
          basics.bmi = v;
          break;
        case 'core.fasting_glucose':
          glucose.fasting = String(v);
          break;
        case 'core.tc':
          lipids.tc = String(v);
          break;
        case 'core.tg':
          lipids.tg = String(v);
          break;
        case 'core.ldl':
          lipids.ldl = String(v);
          break;
        case 'core.hdl':
          lipids.hdl = String(v);
          break;
      }
    }
    checkup.basics = basics;
    labBasic.lipids = lipids;
    labBasic.glucose = glucose;
    checkup.labBasic = labBasic;
    record.checkup = checkup;

    await supabase
      .from('health_archives')
      .update({
        health_record: record,
        recompute_status: 'succeeded',
        updated_at: new Date().toISOString(),
      })
      .eq('checkup_id', checkupId);

    await supabase
      .from('health_assessment_runs')
      .update({
        status: 'succeeded',
        finished_at: new Date().toISOString(),
        input_snapshot: { observationCount: obs?.length ?? 0 },
      })
      .eq('id', run?.id);

    return new Response(
      JSON.stringify({
        success: true,
        runId: run?.id,
        message: 'materialize complete; invoke client recompute for full AI assessment',
      }),
      { headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ success: false, message: String(e) }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});
