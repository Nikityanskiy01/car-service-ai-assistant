# Strix — AI-пентест этого проекта

[Strix](https://github.com/usestrix/strix) — автономные агенты, которые динамически проверяют приложение и оставляют только подтверждённые находки. В этом репозитории он подключён как Cursor-скиллы + локальный CLI.

Официальные доки: [docs.strix.ai](https://docs.strix.ai). Для агента: скиллы `penetration-testing-with-strix`, `fix-security-vulnerabilities-with-strix`, `ci-security-scanning-with-strix`, `managed-pentesting-with-strix`.

## Что уже стоит на этой машине

- CLI `strix` 1.5.3 (`~/.strix/bin`, после установки: `source ~/.bashrc`)
- Docker-образ песочницы `ghcr.io/usestrix/strix-sandbox`
- Четыре скилла в `.agents/skills/` и `.cursor/skills/`
- Шаблон переменных: [`.env.strix.example`](../.env.strix.example)

Скиллы и `.cursor/` в git не коммитятся. На другой машине:

```bash
npx skills add usestrix/strix -y --agent cursor --copy
# или восстановить из lock:
npx skills experimental_install
```

CLI:

```bash
curl -sSL https://strix.ai/install | bash
source ~/.bashrc
```

## LLM (обязательно перед сканом)

Strix сам ходит в модель (это не `LLM_*` бэкенда автосервиса). Нужны две переменные:

```bash
export STRIX_LLM="openai/gpt-5.4"
export LLM_API_KEY="..."
```

Рекомендуемые модели: `openai/gpt-5.4`, `anthropic/claude-sonnet-4-6`. Локальный `qwen2.5:7b` для агентного пентеста слабый — tool calling часто ломается.

VseLLM / OpenAI-compatible:

```bash
export STRIX_LLM="openai/qwen3.5-flash"
export LLM_API_BASE="https://api.vsellm.ru/v1"
export LLM_API_KEY="..."
```

Конфиг после первого запуска сохраняется в `~/.strix/cli-config.json`. Ключи в репозиторий не класть.

Без своего LLM — облако [app.strix.ai](https://app.strix.ai) и скилл `managed-pentesting-with-strix` (токен `STRIX_API_TOKEN`).

## Разрешённые цели

Сканировать только то, чем владеете:

| Цель | Когда |
|------|--------|
| `./` (этот репозиторий) | white-box по коду |
| `http://127.0.0.1:8080` | живой локальный Docker-стек |
| `http://127.0.0.1:3000` + OpenAPI | API |
| `https://autoservice-demo.zernov.online` | своё демо, если явно нужно |

Чужие сайты и чужие репозитории — нельзя.

Перед black-box по локальному стеку он должен быть поднят:

```bash
sudo docker compose --env-file .env.proxmox up -d --build
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8080/
```

## Как пользоваться из Cursor

В новом чате (чтобы подхватились скиллы):

- «Прогони Strix quick по репозиторию и локальному сайту, бюджет $10»
- «Почини critical/high из последнего прогона Strix и пересканируй»
- «Добавь Strix в CI на каждый PR»

Агент обязан прочитать соответствующий `SKILL.md` и запускать CLI с `-n` (без TUI).

## Команды CLI

Всегда `-n` (headless) и `--max-budget`, иначе агент зависнет в интерактивном UI.

```bash
# Быстрый white-box по коду (минуты)
strix -n -t ./ --scan-mode quick --max-budget 10

# Код + живой сайт (лучше покрытие)
strix -n -t ./ -t http://127.0.0.1:8080 --scan-mode quick --max-budget 10

# API по контракту
strix -n \
  -t ./specs/001-ai-consultation-platform/contracts/openapi.yaml \
  -t http://127.0.0.1:3000 \
  --scan-mode quick --max-budget 10

# Grey-box: учётки seed из docs/ONBOARDING.md (пароли из DEMO_*_PASSWORD)
strix -n -t http://127.0.0.1:8080 \
  --instruction "Authenticated tests as client@example.local. Focus on IDOR, authz, guest session." \
  --max-budget 15
```

Режимы: `quick` (минуты) · `standard` (~30 мин) · `deep` (часы).

Коды выхода: `0` — в проанализированном куске дыр нет, `1` — ошибка запуска, `2` — есть подтверждённые находки. `0` не значит «всё чисто», если упёрлись в бюджет: смотрите `strix_runs/<run>/run.json` (`status`, стоимость vs бюджет).

Артефакты (в git не попадают):

```
strix_runs/<имя-прогона>/
  penetration_test_report.md
  vulnerabilities/*.md
  vulnerabilities.json
  findings.sarif
  run.json
```

Локальный дашборд последнего прогона: `strix view`.

## Починить находки

1. Прочитать отчёт и `vulnerabilities/*.md`.
2. Закрыть причину (параметризация, проверка доступа на сервере, allowlist), а не конкретный payload.
3. Пересобрать Docker, если менялся runtime.
4. Пересканировать в `quick` с фокусом на исправленное.

## CI

Скилл `ci-security-scanning-with-strix`: на PR — `quick` по diff, секреты `STRIX_LLM` и `LLM_API_KEY`. Либо GitHub-приложение app.strix.ai без Docker в раннере.

## Не путать с бэкенд-LLM

`LLM_API_KEY` в `backend/.env` — для консультаций автосервиса. У Strix свой `STRIX_LLM` / `LLM_API_KEY` в окружении CLI.
