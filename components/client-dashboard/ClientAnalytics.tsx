'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { TrendingUp, Plus, Activity, Calendar } from 'lucide-react';

interface MetricEntry {
  id: string;
  metric_type: string;
  value: number;
  recorded_at: string;
}

export default function ClientAnalytics() {
  const [metrics, setMetrics] = useState<MetricEntry[]>([]);
  const [activeTab, setActiveTab] = useState<string>('weight'); // 'weight' | 'calories' | 'waist'

  // Состояния для формы добавления
  const [newValue, setNewValue] = useState<string>('');
  const [newDate, setNewDate] = useState<string>(new Date().toISOString().split('T')[0]);

  const [loading, setLoading] = useState<boolean>(false);
  // Инициализируем true — иначе setFetching(true) вызывался бы синхронно внутри
  // эффекта (react-hooks/set-state-in-effect). Флаг гасится в finally после await.
  const [fetching, setFetching] = useState<boolean>(true);

  // Карта названий и единиц измерения
  const metricConfig: Record<string, { label: string; unit: string; color: string }> = {
    weight: { label: 'Вес тела', unit: 'кг', color: '#00F5D4' },
    calories: { label: 'Калораж', unit: 'ккал', color: '#3A86FF' },
    waist: { label: 'Обхват талии', unit: 'см', color: '#FF007F' },
  };

  // 1. Загрузка метрик из Supabase — только возвращает данные, без setState,
  // чтобы setState жил в callback эффекта (.then), как требует react-hooks/set-state-in-effect.
  const loadMetrics = async (): Promise<MetricEntry[] | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('client_metrics')
        .select('id, metric_type, value, recorded_at')
        .eq('client_id', user.id) // Явный фильтр по пользователю (не полагаемся только на RLS)
        .order('recorded_at', { ascending: true }); // Для правильного отображения на графике слева направо

      if (error) throw error;
      return data ?? [];
    } catch (err) {
      console.error('Ошибка загрузки метрик:', err);
      return null;
    }
  };

  useEffect(() => {
    let cancelled = false;
    // setState внутри callback — разрешённый правилом паттерн.
    loadMetrics().then((data) => {
      if (cancelled) return;
      if (data) setMetrics(data);
      setFetching(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // Фильтруем метрики для текущего активного таба
  const filteredMetrics = metrics.filter((m) => m.metric_type === activeTab);

  // 2. Отправка новой метрики в БД
  const handleAddMetric = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newValue || isNaN(Number(newValue))) return;

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('client_metrics')
        .insert([
          {
            client_id: user.id,
            metric_type: activeTab,
            value: Number(newValue),
            recorded_at: newDate,
          },
        ]);

      if (error) throw error;

      setNewValue('');
      const fresh = await loadMetrics(); // Перезагружаем данные (вне эффекта — setState здесь допустим)
      if (fresh) setMetrics(fresh);
    } catch (err) {
      console.error('Ошибка добавления метрики:', err);
    } finally {
      setLoading(false);
    }
  };

  // Расчет параметров для адаптивного SVG-графика
  const generateSvgPath = () => {
    if (filteredMetrics.length < 2) return '';
    const width = 500;
    const height = 150;
    const padding = 20;

    const values = filteredMetrics.map((m) => m.value);
    const minVal = Math.min(...values) * 0.99; // Небольшой отступ снизу
    const maxVal = Math.max(...values) * 1.01; // Небольшой отступ сверху
    const valRange = maxVal - minVal || 1;

    const points = filteredMetrics.map((m, index) => {
      const x = padding + (index / (filteredMetrics.length - 1)) * (width - padding * 2);
      const y = height - padding - ((m.value - minVal) / valRange) * (height - padding * 2);
      return `${x},${y}`;
    });

    return `M ${points.join(' L ')}`;
  };

  return (
    <div className="w-full bg-[#1A1A1A] border border-[#262626] rounded-xl p-6 text-white mb-6 animate-fadeIn">
      <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
        <Activity className="w-5 h-5 text-[#00F5D4]" />
        Кастомная аналитика показателей
      </h2>

      {/* Табы переключения типов метрик */}
      <div className="flex space-x-2 border-b border-[#262626] pb-4 mb-6">
        {Object.keys(metricConfig).map((type) => (
          <button
            key={type}
            onClick={() => setActiveTab(type)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 ${
              activeTab === type
                ? 'bg-[#0A0A0A] text-[#00F5D4] border border-[#262626]'
                : 'text-gray-400 hover:text-white bg-transparent'
            }`}
          >
            {metricConfig[type].label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Форма добавления нового замера */}
        <div className="bg-[#0A0A0A] border border-[#262626] rounded-xl p-4 flex flex-col justify-between h-fit">
          <h3 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-1.5">
            <Plus className="w-4 h-4 text-[#00F5D4]" />
            Внести новый замер
          </h3>
          <form onSubmit={handleAddMetric} className="space-y-4">
            <div>
              <label className="block text-[11px] text-gray-500 mb-1">Значение ({metricConfig[activeTab].unit})</label>
              <input
                type="number"
                step="0.1"
                required
                placeholder={`Например: ${activeTab === 'weight' ? '75.5' : '2300'}`}
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                className="w-full bg-[#1A1A1A] border border-[#262626] rounded-lg p-2.5 text-sm text-white focus:border-[#00F5D4] focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-[11px] text-gray-500 mb-1">Дата замера</label>
              <input
                type="date"
                required
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="w-full bg-[#1A1A1A] border border-[#262626] rounded-lg p-2.5 text-sm text-white focus:border-[#00F5D4] focus:outline-none transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 bg-[#00F5D4] hover:bg-[#00D6B8] disabled:bg-gray-700 text-black font-bold text-xs rounded-lg transition-colors"
            >
              {loading ? 'Сохранение...' : 'Зафиксировать'}
            </button>
          </form>
        </div>

        {/* Интерактивный SVG график прогресса */}
        <div className="md:col-span-2 bg-[#0A0A0A] border border-[#262626] rounded-xl p-4 flex flex-col justify-between min-h-[220px]">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-[#00F5D4]" />
              График изменений
            </h3>
            {filteredMetrics.length > 0 && (
              <span className="text-xs font-mono text-[#00F5D4] bg-[#1A1A1A] px-2 py-0.5 border border-[#262626] rounded">
                Текущий: {filteredMetrics[filteredMetrics.length - 1].value} {metricConfig[activeTab].unit}
              </span>
            )}
          </div>

          <div className="flex-1 flex items-center justify-center w-full">
            {fetching ? (
              <p className="text-xs text-gray-600">Загрузка данных аналитики...</p>
            ) : filteredMetrics.length >= 2 ? (
              <div className="w-full h-full pt-4">
                <svg viewBox="0 0 500 150" className="w-full h-[140px] overflow-visible">
                  {/* Плавная линия графика */}
                  <path
                    d={generateSvgPath()}
                    fill="none"
                    stroke={metricConfig[activeTab].color}
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="drop-shadow-[0_2px_8px_rgba(0,245,212,0.4)]"
                  />
                  {/* Точки на графике */}
                  {filteredMetrics.map((m, idx) => {
                    const width = 500;
                    const height = 150;
                    const padding = 20;
                    const values = filteredMetrics.map((v) => v.value);
                    const minVal = Math.min(...values) * 0.99;
                    const maxVal = Math.max(...values) * 1.01;
                    const valRange = maxVal - minVal || 1;

                    const cx = padding + (idx / (filteredMetrics.length - 1)) * (width - padding * 2);
                    const cy = height - padding - ((m.value - minVal) / valRange) * (height - padding * 2);

                    return (
                      <g key={m.id} className="group/point">
                        <circle
                          cx={cx}
                          cy={cy}
                          r="4"
                          fill="#0A0A0A"
                          stroke={metricConfig[activeTab].color}
                          strokeWidth="2"
                        />
                        {/* Тултип при ховере на точку */}
                        <text
                          x={cx}
                          y={cy - 10}
                          textAnchor="middle"
                          className="hidden group-hover/point:block fill-white text-[10px] font-mono bg-black"
                        >
                          {m.value}
                        </text>
                      </g>
                    );
                  })}
                </svg>
                {/* Подписи дат (Первая и Последняя по краям) */}
                <div className="flex justify-between items-center text-[10px] text-gray-600 font-mono px-2 mt-1">
                  <span>{filteredMetrics[0].recorded_at}</span>
                  <span>{filteredMetrics[filteredMetrics.length - 1].recorded_at}</span>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-xs text-gray-600 border border-dashed border-[#262626] rounded-xl w-full flex flex-col items-center justify-center p-4">
                <Calendar className="w-5 h-5 mb-1 text-gray-700" />
                <span>Недостаточно данных для графика. Внесите минимум 2 замера.</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
