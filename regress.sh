#!/usr/bin/env bash
# Регресс MyoFitness — запускать из корня ~/vibefitness
set -uo pipefail
FAIL=0
pass(){ echo "  ✅ $1"; }
fail(){ echo "  ❌ $1"; FAIL=1; }

echo "=== 1. Сборка и типы ==="
npx tsc --noEmit && pass "tsc --noEmit = 0" || fail "tsc нашёл ошибки типов"
npx next build   && pass "next build прошёл" || fail "next build упал"

echo "=== 2. Линт ==="
npx eslint . && pass "eslint чисто" || fail "eslint нашёл проблемы"

echo "=== 3. Инварианты итераций (grep-регресс) ==="

# Iter5: middleware → proxy
[ ! -f middleware.ts ] && pass "middleware.ts удалён" || fail "middleware.ts всё ещё существует"
[ -f proxy.ts ] && grep -q "export async function proxy" proxy.ts \
  && pass "proxy.ts на месте, функция proxy" || fail "proxy.ts отсутствует/неверная сигнатура"
grep -q "/settings/:path\*" proxy.ts && pass "/settings в matcher" || fail "/settings не в matcher"

# Iter5: никакого any во всём коде
if grep -rn --include='*.ts' --include='*.tsx' ': any\b\|<any>\|as any' app providers lib components 2>/dev/null | grep -v node_modules; then
  fail "найден any"; else pass "any отсутствует"; fi

# Iter5: params не в синхронной форме
if grep -rn "params }: { params: { " app 2>/dev/null; then
  fail "синхронный params (Next 16 требует Promise + use())"; else pass "params через Promise/use()"; fi

# Iter1/2: auth только через @supabase/ssr (createBrowserClient), не прямой createClient для auth
if grep -rn "from \"@supabase/supabase-js\"" lib 2>/dev/null | grep -i "createClient"; then
  fail "прямой createClient из supabase-js в lib (нужен createBrowserClient из ssr)"; else pass "auth-клиент через @supabase/ssr"; fi

# No ghost imports (инвариант проекта)
if grep -rn "InteractivePlanner\|ContextChatEngine\|PremiumWorkoutBuilder" app providers lib components 2>/dev/null; then
  fail "ghost-импорт (несуществующий компонент)"; else pass "ghost-импортов нет"; fi

# Iter2/4: нет невозможного union роли в ТИПАХ.
# Сравнение в гейте через .toUpperCase() === "TRAINER" — это правильный паттерн (инвариант №1),
# поэтому строки с .toUpperCase() исключаем из проверки.
if grep -rn '"CLIENT"\|"TRAINER"' app providers 2>/dev/null | grep -v '\.toUpperCase()\|===\|!=='; then
  fail "uppercase-литерал роли в типах"; else pass "роль канонично lowercase (гейты через toUpperCase — ок)"; fi
if grep -rn "as LocalProfile" providers 2>/dev/null; then
  fail "as LocalProfile каст в AuthProvider"; else pass "нет as LocalProfile каста"; fi

# Iter4: единственный Toaster (глобальный в layout)
TC=$(grep -rln "<Toaster" app 2>/dev/null | wc -l | tr -d ' ')
[ "$TC" = "1" ] && pass "Toaster ровно один (глобальный)" || fail "Toaster встречается $TC раз (ожидался 1)"

echo "==============================="
[ "$FAIL" = "0" ] && echo "РЕГРЕСС ПРОЙДЕН ✅" || echo "ЕСТЬ РЕГРЕССИИ ❌"
exit $FAIL
