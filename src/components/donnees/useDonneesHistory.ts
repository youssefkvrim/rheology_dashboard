import { useEffect, useState } from 'react';
import { fetchRheologyAll } from '../../services/api';
import { ALL_DB_KEYS, FRONTEND_TO_DB } from '../../shared/metricKeys';
import type { Barbotine } from '../../types/domain';
import type { HistoryMap, TableMetricKey } from './HistoryTable';

function dayKey(ts: number) {
  const d = new Date(ts);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function toLocalDateTimeInput(ts: number) {
  const d = new Date(ts);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function sortDataBarbotines(a: Barbotine, b: Barbotine) {
  const group = (name: string) => name.includes('M7-3') ? 0 : name.includes('2CN2') ? 1 : name.includes('R55') ? 2 : 3;
  const ga = group(a.name);
  const gb = group(b.name);
  if (ga !== gb) return ga - gb;
  return a.name.localeCompare(b.name);
}

export function useDonneesHistory(barbotines: Barbotine[]) {
  const [manualStart, setManualStart] = useState('');
  const [manualEnd, setManualEnd] = useState('');
  const [manualHistoryMap, setManualHistoryMap] = useState<HistoryMap>({});
  const [manualDayList, setManualDayList] = useState<string[]>([]);
  const [loadingManual, setLoadingManual] = useState(false);

  const [histStart, setHistStart] = useState('');
  const [histEnd, setHistEnd] = useState('');
  const [histLoadAll, setHistLoadAll] = useState(false);
  const [historyMap, setHistoryMap] = useState<HistoryMap>({});
  const [dayList, setDayList] = useState<string[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const handleLoadAllHistory = async () => {
    setLoadingHistory(true);
    try {
      let minTs = Infinity;
      let maxTs = -Infinity;
      for (const b of barbotines) {
        const sid = b.slurryId;
        if (!sid) continue;
        const { series } = await fetchRheologyAll(sid, [FRONTEND_TO_DB.densite], false);
        const pts = series[FRONTEND_TO_DB.densite] || [];
        for (const p of pts) {
          const t = Number(p.t);
          if (t < minTs) minTs = t;
          if (t > maxTs) maxTs = t;
        }
      }
      if (Number.isFinite(minTs) && Number.isFinite(maxTs)) {
        setHistStart(toLocalDateTimeInput(minTs));
        setHistEnd(toLocalDateTimeInput(maxTs));
        setHistLoadAll(true);
      }
    } catch {}
    setLoadingHistory(false);
  };

  useEffect(() => {
    const s = Date.parse(histStart);
    const e = Date.parse(histEnd);
    const hasDates = Number.isFinite(s) && Number.isFinite(e);
    if (!hasDates && !histLoadAll) {
      setHistoryMap({});
      setDayList([]);
      return;
    }
    let cancelled = false;
    async function load() {
      let startTs = Number.isFinite(s) ? s : NaN;
      let endTs = Number.isFinite(e) ? e : NaN;
      let globalMin = Number.POSITIVE_INFINITY;
      let globalMax = Number.NEGATIVE_INFINITY;
      setLoadingHistory(true);
      try {
        const nextMap: HistoryMap = {};
        const daysSet = new Set<string>();
        await Promise.all([...barbotines].sort(sortDataBarbotines).map(async (b) => {
          const sid = b.slurryId;
          if (!sid) return;
          try {
            const all = await fetchRheologyAll(sid, ALL_DB_KEYS, false);
            const series = all.series || {};
            const perMetric: Record<string, Map<string, { t:number; v:number }>> = {};
            for (const k of ALL_DB_KEYS) {
              const allArr = series[k] || [];
              for (const d of allArr) { if (d.t < globalMin) globalMin = d.t; if (d.t > globalMax) globalMax = d.t; }
              const arr = Number.isFinite(startTs) && Number.isFinite(endTs) ? allArr.filter(d => d.t >= startTs && d.t <= endTs) : allArr;
              const m = new Map<string, { t:number; v:number }>();
              for (const d of arr) {
                const dk = dayKey(d.t);
                const prev = m.get(dk);
                if (!prev || d.t > prev.t) m.set(dk, d);
              }
              perMetric[k] = m;
            }
            const dkAll = new Set<string>();
            Object.values(perMetric).forEach(m => m.forEach((_, dk) => dkAll.add(dk)));
            dkAll.forEach(dk => {
              daysSet.add(dk);
              if (!nextMap[dk]) nextMap[dk] = {};
              if (!nextMap[dk][b.name]) nextMap[dk][b.name] = {};
              const row = nextMap[dk][b.name]!;
              for (const src of ALL_DB_KEYS) {
                const rec = perMetric[src].get(dk);
                if (rec) row[src] = Number(rec.v);
              }
            });
          } catch {}
        }));
        if (cancelled) return;
        if (histLoadAll && !hasDates && Number.isFinite(globalMin) && Number.isFinite(globalMax)) {
          const dStart = new Date(globalMin); dStart.setHours(0, 0, 0, 0);
          const dEnd = new Date(globalMax); dEnd.setHours(23, 59, 0, 0);
          startTs = dStart.getTime(); endTs = dEnd.getTime();
          setHistStart(toLocalDateTimeInput(startTs));
          setHistEnd(toLocalDateTimeInput(endTs));
        }
        const sortedDays = Number.isFinite(startTs) && Number.isFinite(endTs)
          ? (() => {
            const days: string[] = [];
            const d = new Date(startTs); d.setHours(0, 0, 0, 0);
            const end = new Date(endTs); end.setHours(0, 0, 0, 0);
            for (let t = d.getTime(); t <= end.getTime(); t += 24 * 60 * 60 * 1000) {
              const dk = dayKey(t);
              days.push(dk);
              if (!nextMap[dk]) nextMap[dk] = {};
            }
            return days;
          })()
          : Array.from(daysSet).sort();
        setHistoryMap(nextMap);
        setDayList(sortedDays);
      } finally {
        if (!cancelled) setLoadingHistory(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [histStart, histEnd, barbotines, histLoadAll]);

  useEffect(() => {
    let cancelled = false;
    const s = Date.parse(manualStart);
    const e = Date.parse(manualEnd);
    if (!Number.isFinite(s) && !Number.isFinite(e)) {
      setManualHistoryMap({});
      setManualDayList([]);
      return;
    }
    async function loadManual() {
      setLoadingManual(true);
      try {
        const map: HistoryMap = {};
        for (const b of barbotines) {
          const sid = b.slurryId;
          if (!sid) continue;
          const { series } = await fetchRheologyAll(sid, ALL_DB_KEYS, false);
          for (const [param, pts] of Object.entries(series) as [string, Array<{ t:number; v:number }>][]) {
            const mk = param as TableMetricKey;
            for (const p of pts) {
              const t = Number(p.t);
              if (Number.isFinite(s) && t < s) continue;
              if (Number.isFinite(e) && t > e) continue;
              const dk = dayKey(t);
              if (!map[dk]) map[dk] = {};
              if (!map[dk][b.name]) map[dk][b.name] = {};
              map[dk][b.name][mk] = Number(p.v);
            }
          }
        }
        if (cancelled) return;
        setManualHistoryMap(map);
        setManualDayList(Object.keys(map).sort((a, b) => a.localeCompare(b)));
      } catch {}
      if (!cancelled) setLoadingManual(false);
    }
    loadManual();
    return () => { cancelled = true; };
  }, [manualStart, manualEnd, barbotines]);

  return {
    manual: { manualStart, setManualStart, manualEnd, setManualEnd, manualHistoryMap, manualDayList, loadingManual },
    history: { histStart, setHistStart, histEnd, setHistEnd, setHistLoadAll, historyMap, dayList, loadingHistory, handleLoadAllHistory },
  };
}
