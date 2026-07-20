'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { FolderArchive } from 'lucide-react';

// Явный тип вместо any[] — колонки соответствуют select ниже.
interface ArchivedWorkout {
  id: string;
  title: string;
  workout_date: string;
}

export default function ArchivePage() {
  const [archivedWorkouts, setArchivedWorkouts] = useState<ArchivedWorkout[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadArchive() {
      const todayStr = new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('workouts')
        .select('id, title, workout_date')
        .lt('workout_date', todayStr)
        .order('workout_date', { ascending: false });

      if (cancelled) return;
      if (error) {
        console.error('Ошибка загрузки архива:', error);
        setLoading(false);
        return;
      }
      if (data) setArchivedWorkouts(data);
      setLoading(false);
    }
    loadArchive();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="w-full max-w-4xl mx-auto bg-[#1A1A1A] border border-[#262626] rounded-xl p-6 text-white font-mono">
      <h2 className="text-sm font-bold mb-6 flex items-center gap-2 uppercase tracking-wider">
        <FolderArchive className="w-4 h-4 text-[#00F5D4]" />
        Архив тренировок
      </h2>

      {loading ? (
        <p className="text-gray-500 text-xs text-center py-4">Загрузка архива...</p>
      ) : archivedWorkouts.length > 0 ? (
        <div className="space-y-3">
          {archivedWorkouts.map((workout) => (
            <div key={workout.id} className="p-4 bg-[#0A0A0A] border border-[#262626] rounded-lg flex justify-between items-center">
              <div>
                <h4 className="font-medium text-xs text-gray-200">{workout.title}</h4>
                <p className="text-[10px] text-gray-500 mt-1">Дата: {workout.workout_date}</p>
              </div>
              <span className="text-[10px] px-2 py-0.5 bg-[#262626] text-gray-400 rounded-full">Прошедшая</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-500 text-xs text-center py-8 border border-dashed border-[#262626] rounded-lg">
          Архив пуст.
        </p>
      )}
    </div>
  );
}
