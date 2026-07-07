'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Dumbbell, Calendar } from 'lucide-react';

interface WorkoutCard {
  id: string;
  title: string;
  workout_date: string;
  creator_id: string;
}

interface DaySchedule {
  name: string;
  shortName: string;
  dateString: string;
  isToday: boolean;
  workouts: WorkoutCard[];
}

export default function WeeklySchedule() {
  const [weekDays, setWeekDays] = useState<DaySchedule[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function fetchWeeklyWorkouts() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // 1. Генерируем массив дат текущей недели (Пн - Вс)
        const today = new Date();
        const currentDayOfWeek = today.getDay(); // 0 = Вс, 1 = Пн, ..., 6 = Сб
        
        // Корректируем, чтобы неделя начиналась с Понедельника (в JS 0 — это Воскресенье)
        const distanceToMonday = currentDayOfWeek === 0 ? -6 : 1 - currentDayOfWeek;
        const monday = new Date(today);
        monday.setDate(today.getDate() + distanceToMonday);

        const daysNames = [
          { name: 'Понедельник', short: 'Пн' },
          { name: 'Вторник', short: 'Вт' },
          { name: 'Среда', short: 'Ср' },
          { name: 'Четверг', short: 'Чт' },
          { name: 'Пятница', short: 'Пт' },
          { name: 'Суббота', short: 'Сб' },
          { name: 'Воскресенье', short: 'Вс' },
        ];

        const generatedDays: DaySchedule[] = [];
        const dateStrings: string[] = [];

        for (let i = 0; i < 7; i++) {
          const currentDay = new Date(monday);
          currentDay.setDate(monday.getDate() + i);
          
          // Форматируем дату в YYYY-MM-DD для фильтрации в БД
          const dateStr = currentDay.toISOString().split('T')[0];
          dateStrings.push(dateStr);

          // Проверяем, совпадает ли с сегодняшним числом (с учетом локального часового пояса)
          const isToday = dateStr === today.toISOString().split('T')[0];

          generatedDays.push({
            name: daysNames[i].name,
            shortName: daysNames[i].short,
            dateString: dateStr,
            isToday,
            workouts: []
          });
        }

        // 2. Делаем запрос в Supabase на тренировки в диапазоне текущей недели
        // Благодаря нашему RLS, клиент вытянет только свои тренировки
        const { data: workouts, error } = await supabase
          .from('workouts')
          .select('id, title, workout_date, creator_id')
          .in('workout_date', dateStrings);

        if (error) throw error;

        // 3. Распределяем полученные тренировки по дням недели
        if (workouts) {
          workouts.forEach((workout: WorkoutCard) => {
            const dayIndex = generatedDays.findIndex(d => d.dateString === workout.workout_date);
            if (dayIndex !== -1) {
              generatedDays[dayIndex].workouts.push(workout);
            }
          });
        }

        setWeekDays(generatedDays);
      } catch (err) {
        console.error('Ошибка при загрузке расписания на неделю:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchWeeklyWorkouts();
  }, []);

  if (loading) {
    return (
      <div className="w-full bg-[#1A1A1A] border border-[#262626] rounded-xl p-6 text-center text-gray-400">
        Загрузка расписания на неделю...
      </div>
    );
  }

  return (
    <div className="w-full bg-[#1A1A1A] border border-[#262626] rounded-xl p-6 text-white mb-6">
      <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
        <Calendar className="w-5 h-5 text-[#00F5D4]" />
        Расписание на неделю
      </h2>

      {/* Адаптивная календарная сетка: на мобилках в один столбец, на десктопе в 7 колонок */}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
        {weekDays.map((day) => (
          <div 
            key={day.dateString} 
            className={`p-4 rounded-xl border flex flex-col min-h-[140px] transition-all duration-200 ${
              day.isToday 
                ? 'bg-[#0A0A0A] border-[#00F5D4] shadow-[0_0_15px_rgba(0,245,212,0.15)]' // Подсветка текущего дня по ТЗ
                : 'bg-[#0A0A0A] border-[#262626] hover:border-gray-700'
            }`}
          >
            {/* Шапка дня */}
            <div className="flex justify-between items-center mb-3">
              <span className={`text-sm font-semibold ${day.isToday ? 'text-[#00F5D4]' : 'text-gray-300'}`}>
                {day.name}
              </span>
              <span className="text-xs text-gray-500">
                {day.shortName}
              </span>
            </div>

            {/* Карточки тренировок внутри дня */}
            <div className="flex-1 space-y-2">
              {day.workouts.length > 0 ? (
                day.workouts.map((workout) => (
                  <div
                    key={workout.id}
                    onClick={() => window.location.href = `/client/workout/${workout.id}`} // Переход к выполнению тренировки по ТЗ
                    className="p-2.5 bg-[#1A1A1A] border border-[#262626] rounded-lg hover:border-[#00F5D4] cursor-pointer transition-all duration-150 group flex flex-col justify-between"
                  >
                    <span className="text-xs font-medium text-gray-200 group-hover:text-[#00F5D4] transition-colors line-clamp-2">
                      {workout.title}
                    </span>
                    <div className="mt-1.5 flex items-center justify-between text-[10px] text-gray-500">
                      <span className="flex items-center gap-0.5">
                        <Dumbbell className="w-3 h-3" />
                        {workout.creator_id === workout.id ? 'Кастомная' : 'От тренера'}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="h-full flex items-center justify-center text-[11px] text-gray-600 border border-dashed border-[#262626] rounded-lg py-4">
                  Нет тренировок
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}