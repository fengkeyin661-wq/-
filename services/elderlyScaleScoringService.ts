import type {
  ElderlyAssessmentData,
  ElderlyScaleResponses,
  ElderlyScaleScoreEntry,
} from '../types';
import {
  ELDERLY_SCALES,
  type ElderlyScaleId,
  type ScaleCutoff,
  getScaleById,
} from './elderlyScreeningCatalog';

export interface ScaleInterpretation {
  scaleId: ElderlyScaleId;
  name: string;
  total: number;
  level: string;
  label: string;
}

const sum = (arr?: number[]) => (arr || []).reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);

export const matchCutoff = (total: number, cutoffs: ScaleCutoff[]): ScaleCutoff => {
  for (const c of cutoffs) {
    const minOk = c.min === undefined || total >= c.min;
    const maxOk = c.max === undefined || total <= c.max;
    if (minOk && maxOk) return c;
  }
  return cutoffs[cutoffs.length - 1];
};

export const computeMiniCogTotal = (miniCog?: ElderlyScaleResponses['miniCog']): number | undefined => {
  if (!miniCog || miniCog.recall === undefined || miniCog.clock === undefined) return undefined;
  return miniCog.recall + miniCog.clock;
};

export const computeScaleTotal = (scaleId: ElderlyScaleId, responses: ElderlyScaleResponses): number | undefined => {
  switch (scaleId) {
    case 'barthel':
      return responses.barthel?.length === 10 ? sum(responses.barthel) : undefined;
    case 'lawton':
      return responses.lawton?.length === 8 ? sum(responses.lawton) : undefined;
    case 'morse':
      return responses.morse?.length === 6 ? sum(responses.morse) : undefined;
    case 'miniCog':
      return computeMiniCogTotal(responses.miniCog);
    case 'gds15':
      return responses.gds15?.length === 15 ? sum(responses.gds15) : undefined;
    case 'phq9':
      return responses.phq9?.length === 9 ? sum(responses.phq9) : undefined;
    case 'gad7':
      return responses.gad7?.length === 7 ? sum(responses.gad7) : undefined;
    case 'ucla3':
      return responses.ucla3?.length === 3 ? sum(responses.ucla3) : undefined;
    case 'mnaSf':
      return responses.mnaSf?.length === 6 ? sum(responses.mnaSf) : undefined;
    case 'hhieS':
      return responses.hhieS?.length === 10 ? sum(responses.hhieS) : undefined;
    case 'gohai':
      return responses.gohai?.length === 5 ? sum(responses.gohai) : undefined;
    case 'isi':
      return responses.isi?.length === 7 ? sum(responses.isi) : undefined;
    case 'frail':
      return responses.frail?.length === 5 ? responses.frail.filter(Boolean).length : undefined;
    case 'lsns6':
      return responses.lsns6?.length === 6 ? sum(responses.lsns6) : undefined;
    default:
      return undefined;
  }
};

export const interpretScale = (scaleId: ElderlyScaleId, total: number): ScaleInterpretation => {
  const def = getScaleById(scaleId)!;
  const cutoff = matchCutoff(total, def.cutoffs);
  return {
    scaleId,
    name: def.name,
    total,
    level: cutoff.level,
    label: cutoff.label,
  };
};

export const computeOstaScore = (input: {
  age?: number;
  weightKg?: number;
  gender?: string;
}): number | undefined => {
  const { age, weightKg, gender } = input;
  if (age === undefined || weightKg === undefined || !gender) return undefined;
  const sexFactor = gender.includes('女') ? 0 : 1;
  return 0.1 * weightKg - age * sexFactor;
};

export const interpretOsta = (score: number): ScaleInterpretation => {
  let level = 'low';
  let label = '低风险（≥-1）';
  if (score <= -4) {
    level = 'high';
    label = '骨质疏松高风险（≤-4）';
  } else if (score <= -1) {
    level = 'medium';
    label = '中风险（-4~-1）';
  }
  return { scaleId: 'frail', name: 'OSTA 指数', total: Math.round(score * 10) / 10, level, label };
};

export const computeAllScaleScores = (
  responses: ElderlyScaleResponses = {},
): Record<string, ElderlyScaleScoreEntry> => {
  const out: Record<string, ElderlyScaleScoreEntry> = {};
  for (const def of ELDERLY_SCALES) {
    const total = computeScaleTotal(def.id, responses);
    if (total === undefined) continue;
    const interp = interpretScale(def.id, total);
    out[def.id] = { total: interp.total, level: interp.level, label: interp.label };
  }
  return out;
};

const mapLoneliness = (uclaTotal?: number): ElderlyAssessmentData['emotion']['loneliness'] => {
  if (uclaTotal === undefined) return undefined;
  if (uclaTotal >= 8) return 'severe';
  if (uclaTotal >= 6) return 'moderate';
  if (uclaTotal >= 5) return 'mild';
  return 'none';
};

const mapFallRisk = (morseTotal?: number): ElderlyAssessmentData['functionalStatus']['fallRisk'] => {
  if (morseTotal === undefined) return undefined;
  if (morseTotal >= 51) return 'high';
  if (morseTotal >= 25) return 'medium';
  return 'low';
};

const mapCognitiveRisk = (miniCogTotal?: number): ElderlyAssessmentData['screenings']['cognitiveRisk'] => {
  if (miniCogTotal === undefined) return undefined;
  if (miniCogTotal <= 2) return 'high';
  if (miniCogTotal === 3) return 'moderate';
  if (miniCogTotal <= 4) return 'mild';
  return 'none';
};

const mapFrailty = (frailCount?: number): ElderlyAssessmentData['screenings']['frailty'] => {
  if (frailCount === undefined) return undefined;
  if (frailCount >= 5) return 'frail';
  if (frailCount >= 3) return 'pre';
  return 'none';
};

const mapInsomnia = (isiTotal?: number): ElderlyAssessmentData['sleep']['insomniaSeverity'] => {
  if (isiTotal === undefined) return undefined;
  if (isiTotal >= 22) return 'severe';
  if (isiTotal >= 15) return 'moderate';
  if (isiTotal >= 8) return 'mild';
  return 'none';
};

const mapHearing = (hhieTotal?: number): ElderlyAssessmentData['visionOrHearing']['hearingImpairment'] => {
  if (hhieTotal === undefined) return undefined;
  if (hhieTotal >= 26) return 'severe';
  if (hhieTotal >= 10) return 'moderate';
  if (hhieTotal > 0) return 'mild';
  return 'none';
};

const mapOsteoporosis = (osta?: number): ElderlyAssessmentData['screenings']['osteoporosisRisk'] => {
  if (osta === undefined) return undefined;
  if (osta <= -4) return 'high';
  if (osta <= -1) return 'medium';
  return 'low';
};

/** 从量表作答回填聚合字段，供 evaluateElderlyAssessment 与旧数据兼容 */
export const hydrateElderlyAggregates = (data: ElderlyAssessmentData): ElderlyAssessmentData => {
  const responses = data.scaleResponses || {};
  const scaleScores = computeAllScaleScores(responses);

  const barthel = scaleScores.barthel?.total ?? data.functionalStatus.adlScore;
  const lawton = scaleScores.lawton?.total ?? data.functionalStatus.iadlScore;
  const morse = scaleScores.morse?.total;
  const miniCog = computeMiniCogTotal(responses.miniCog);
  const gds = scaleScores.gds15?.total;
  const phq = scaleScores.phq9?.total ?? data.emotion.depressionScore;
  const gad = scaleScores.gad7?.total ?? data.emotion.anxietyScore;
  const mna = scaleScores.mnaSf?.total ?? data.nutrition.mnaScore;
  const isi = scaleScores.isi?.total;
  const frailCount = scaleScores.frail?.total;
  const hhie = scaleScores.hhieS?.total;
  const gohai = scaleScores.gohai?.total;
  const ucla = scaleScores.ucla3?.total;
  const lsns = scaleScores.lsns6?.total;

  const osta = data.ostaInput
    ? computeOstaScore({
        age: data.ostaInput.age,
        weightKg: data.ostaInput.weightKg,
        gender: data.ostaInput.gender,
      })
    : undefined;

  const mergedScores: Record<string, ElderlyScaleScoreEntry> = { ...scaleScores };
  if (osta !== undefined) {
    const ostaInterp = interpretOsta(osta);
    mergedScores.osta = { total: ostaInterp.total, level: ostaInterp.level, label: ostaInterp.label };
  }

  const chewingDifficulty =
    data.oralHealth.chewingDifficulty ??
    (gohai !== undefined && gohai <= 7 ? true : undefined);

  return {
    ...data,
    meta: {
      version: '2',
      assessedAt: data.meta?.assessedAt || new Date().toISOString(),
      completedDomains: data.meta?.completedDomains || [],
    },
    scaleScores: mergedScores,
    functionalStatus: {
      ...data.functionalStatus,
      adlScore: barthel,
      iadlScore: lawton,
      fallRisk: mapFallRisk(morse) ?? data.functionalStatus.fallRisk,
    },
    emotion: {
      ...data.emotion,
      depressionScore: gds ?? phq,
      anxietyScore: gad,
      loneliness: mapLoneliness(ucla) ?? data.emotion.loneliness,
    },
    nutrition: {
      ...data.nutrition,
      mnaScore: mna,
      appetiteLoss: data.nutrition.appetiteLoss ?? (responses.mnaSf?.[0] === 0 ? true : undefined),
      weightLoss3m: data.nutrition.weightLoss3m ?? (responses.mnaSf?.[1] === 0 ? true : undefined),
    },
    visionOrHearing: {
      ...data.visionOrHearing,
      hearingImpairment: mapHearing(hhie) ?? data.visionOrHearing.hearingImpairment,
    },
    oralHealth: {
      ...data.oralHealth,
      chewingDifficulty,
      oralPain: data.oralHealth.oralPain ?? (gohai !== undefined && gohai <= 7 ? true : undefined),
    },
    sleep: {
      ...data.sleep,
      insomniaSeverity: mapInsomnia(isi) ?? data.sleep.insomniaSeverity,
      daytimeSleepiness: data.sleep.daytimeSleepiness ?? (isi !== undefined && isi >= 15 ? true : undefined),
    },
    screenings: {
      ...data.screenings,
      cognitiveRisk: mapCognitiveRisk(miniCog) ?? data.screenings.cognitiveRisk,
      frailty: mapFrailty(frailCount) ?? data.screenings.frailty,
      osteoporosisRisk: mapOsteoporosis(osta) ?? data.screenings.osteoporosisRisk,
      depressionScreenPositive:
        data.screenings.depressionScreenPositive ??
        ((gds !== undefined && gds >= 5) || (phq !== undefined && phq >= 10)),
    },
    socialNetwork: {
      ...data.socialNetwork,
      lsns6Score: lsns,
      isolationRisk: lsns !== undefined ? lsns < 12 : data.socialNetwork?.isolationRisk,
    },
  };
};

/** 开发期切点自检（构建时无 test runner，供模块导入校验） */
export const runElderlyScoringSelfCheck = (): string[] => {
  const errors: string[] = [];
  const barthel = interpretScale('barthel', 40);
  if (barthel.level !== 'severe') errors.push('Barthel 40 should be severe');
  const mna = interpretScale('mnaSf', 7);
  if (mna.level !== 'malnutrition') errors.push('MNA-SF 7 should be malnutrition');
  const morse = interpretScale('morse', 51);
  if (morse.level !== 'high') errors.push('Morse 51 should be high');
  const gds = interpretScale('gds15', 10);
  if (gds.level !== 'moderate') errors.push('GDS 10 should be moderate');
  const frail = interpretScale('frail', 5);
  if (frail.level !== 'frail') errors.push('FRAIL 5 should be frail');
  const osta = interpretOsta(-5);
  if (osta.level !== 'high') errors.push('OSTA -5 should be high');
  return errors;
};
