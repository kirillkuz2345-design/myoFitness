'use client';

import { useState } from 'react';
import { supabase } from '../../lib/supabase'; // Теперь этот файл физически существует!
import { Plus, Trash2, Save, X } from 'lucide-react';

interface ClientExercise {
  name: string;
  sets: number;
  reps: string;
  weight: number;
  client_note: string;
}

export default function WorkoutConstructor() {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [title, setTitle] = useState<string>('');
  const [exercises, setExercises] = useState<ClientExercise[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<string>('');

  const addExercise = () => {
    setExercises([...exercises, { name: '', sets: 3, reps: '10', weight: 0, client_note: '' }]);
  };

  const removeExercise = (index: number) => {
    setExercises(exercises.filter((_, i) => i !== index));
  };

  const handleExerciseChange = (index: number, field: keyof ClientExercise, value: any) => {
    const updated = [...exercises];
    updated[index] = { ...updated[index], [field]: value };
    setExercises(updated);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || exercises.length === 0) {
      setMessage('Укажите название и добавьте хотя бы одно упражнение.');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Пользователь не авторизован');

      const { data: workoutData, error: workoutError } = await supabase
        .from('workouts')
        .insert([
          {
            title,
            workout_date: new Date().toISOString().split('T')[0],
            client_id: user.id,
            creator_id: user.id,
          }
        ])
        .select()
        .single();

      if (workoutError) throw workoutError;

      const exercisesToInsert = exercises.map(ex => ({
        workout_id: workoutData.id,
        name: ex.name,
        sets: Number(ex.sets),
        reps: ex.reps,
        weight: ex.weight ? Number(ex.weight) : null,
        client_note: ex.client_note,
        trainer_comment: null
      }));

      const { error: exercisesError } = await supabase
        .from('exercises')
        .insert(exercisesToInsert);

      if (exercisesError) throw exercisesError;

      setMessage('Ваша тренировка успешно создана!');
      setTitle('');
      setExercises([]);
      setTimeout(() => {
        setIsOpen(false);
        setMessage('');
      }, 1500);

    } catch (err: any) {
      setMessage(`Ошибка сохранения: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full text-white my-4">
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="text-[#00F5D4] hover:text-[#00D6B8] font-medium text-base transition-colors duration-200 bg-transparent border-none outline-none cursor-pointer flex items-center gap-1"
        >
          + Создать свою тренировку
        </button>
      ) : (
        <div className="bg-[#1A1A1A] border border-[#262626] rounded-xl p-6 transition-all duration-300 relative">
          <button
            onClick={() => setIsOpen(false)}
            className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <h3 className="text-lg font-bold mb-4 text-[#00F5D4]">Новая тренировка</h3>

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Название тренировки *</label>
              <input
                type="text"
                required
                placeholder="Например: Моя утренняя кардио сессия"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-[#0A0A0A] border border-[#262626] rounded-lg p-2.5 text-sm text-white focus:border-[#00F5D4] focus:outline-none transition-colors"
              />
            </div>

            <div className="space-y-4">
              {exercises.map((exercise, index) => (
                <div key={index} className="p-4 bg-[#0A0A0A] border border-[#262626] rounded-lg space-y-3 relative">
                  <button
                    type="button"
                    onClick={() => removeExercise(index)}
                    className="absolute top-4 right-4 text-gray-500 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pr-6">
                    <div className="md:col-span-2">
                      <input
                        type="text"
                        required
                        placeholder="Упражнение"
                        value={exercise.name}
                        onChange={(e) => handleExerciseChange(index, 'name', e.target.value)}
                        className="w-full bg-[#1A1A1A] border border-[#262626] rounded-md p-2 text-xs text-white focus:border-[#00F5D4] focus:outline-none"
                      />
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        required
                        placeholder="Сеты"
                        value={exercise.sets || ''}
                        onChange={(e) => handleExerciseChange(index, 'sets', e.target.value)}
                        className="w-full bg-[#1A1A1A] border border-[#262626] rounded-md p-2 text-xs text-white focus:border-[#00F5D4] focus:outline-none"
                      />
                      <input
                        type="text"
                        required
                        placeholder="Повторы"
                        value={exercise.reps}
                        onChange={(e) => handleExerciseChange(index, 'reps', e.target.value)}
                        className="w-full bg-[#1A1A1A] border border-[#262626] rounded-md p-2 text-xs text-white focus:border-[#00F5D4] focus:outline-none"
                      />
                    </div>
                    <div>
                      <input
                        type="number"
                        placeholder="Вес (кг)"
                        value={exercise.weight || ''}
                        onChange={(e) => handleExerciseChange(index, 'weight', e.target.value)}
                        className="w-full bg-[#1A1A1A] border border-[#262626] rounded-md p-2 text-xs text-white focus:border-[#00F5D4] focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] text-gray-400 mb-1">Заметка тренеру</label>
                    <textarea
                      placeholder="Например: Немного болело колено на 3-м подходе"
                      value={exercise.client_note}
                      onChange={(e) => handleExerciseChange(index, 'client_note', e.target.value)}
                      rows={2}
                      className="w-full bg-[#1A1A1A] border border-[#262626] rounded-md p-2 text-xs text-white focus:border-[#00F5D4] focus:outline-none resize-none"
                    />
                  </div>

                  <div className="bg-[#141414] border border-dashed border-[#262626] rounded-md p-2 text-[11px] text-gray-500 select-none">
                    <span className="font-semibold text-gray-400">Комментарий тренера:</span> Будет доступен после проверки наставником.
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={addExercise}
                className="flex-1 py-2 bg-transparent border border-[#262626] hover:border-[#00F5D4] text-xs font-semibold rounded-lg transition-colors text-gray-300 hover:text-white"
              >
                + Добавить упражнение
              </button>
              
              <button
                type="submit"
                disabled={loading || exercises.length === 0}
                className="flex-1 py-2 bg-[#00F5D4] hover:bg-[#00D6B8] disabled:bg-gray-700 disabled:text-gray-400 text-black font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1"
              >
                <Save className="w-3.5 h-3.5" />
                {loading ? 'Сохранение...' : 'Сохранить тренировку'}
              </button>
            </div>

            {message && (
              <p className={`text-xs text-center mt-2 ${message.includes('Ошибка') || message.includes('Укажите') ? 'text-red-400' : 'text-[#00F5D4]'}`}>
                {message}
              </p>
            )}
          </form>
        </div>
      )}
    </div>
  );
}