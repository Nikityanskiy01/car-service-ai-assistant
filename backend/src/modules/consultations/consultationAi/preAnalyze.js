import { maxUrgency } from './quality.js';

export function preAnalyzeSymptoms(data) {
  const symptoms = String(data?.symptoms || '').toLowerCase();
  const conditions = String(data?.conditions || data?.problemConditions || '').toLowerCase();
  const joined = `${symptoms} ${conditions}`.trim();

  const causes = [];
  const checks = [];
  let urgency = 'low';
  let rulesMatched = 0;

  const pushCause = (x) => {
    const s = String(x).trim();
    if (s && !causes.some((c) => c.toLowerCase() === s.toLowerCase())) causes.push(s);
  };
  const pushCheck = (x) => {
    const s = String(x).trim();
    if (s && !checks.some((c) => c.toLowerCase() === s.toLowerCase())) checks.push(s);
  };
  const raiseUrgency = (lvl) => {
    urgency = maxUrgency(urgency, lvl);
  };

  // 1. Тормоза: биение руля + при торможении
  if (symptoms.includes('биение руля') && conditions.includes('при торможении')) {
    rulesMatched++;
    pushCause('Деформация тормозных дисков');
    pushCause('Неравномерный износ тормозных колодок');
    pushCheck('Снять колёса и визуально оценить диски: трещины, ржавчина, следы перегрева');
    pushCheck('Промерить толщину тормозных дисков и колодок щупом/штангенциркулем по мануалу');
    pushCheck('Проверить биение диска при вращении (индикатор) и люфт направляющих суппорта');
    raiseUrgency('high');
  }

  // 1b. Вибрация руля при торможении (частый реальный кейс)
  if (
    (symptoms.includes('вибрац') && symptoms.includes('рул') && symptoms.includes('тормож')) ||
    (symptoms.includes('вибрац') && symptoms.includes('рул') && conditions.includes('тормож'))
  ) {
    rulesMatched++;
    pushCause('Деформация или перегрев тормозных дисков');
    pushCause('Неравномерный износ колодок и направляющих суппорта');
    pushCause('Люфт элементов передней подвески или ступичного узла');
    pushCheck('Проверить биение передних тормозных дисков индикатором на ступице');
    pushCheck('Осмотреть колодки, направляющие и поршни суппортов на заедание');
    pushCheck('Проверить люфты ступичных подшипников, рулевых наконечников и шаровых опор');
    raiseUrgency('high');
  }

  // 2. Стук на неровной дороге
  if (symptoms.includes('посторонний стук') && conditions.includes('на неровной дороге')) {
    rulesMatched++;
    pushCause('Стойки стабилизатора');
    pushCause('Втулки стабилизатора');
    pushCause('Шаровые опоры');
    pushCheck('Покачать стабилизатор: слушать стук в сайлентблоках и втулках');
    pushCheck('На подъёмнике проверить люфт шаровых и опор амортизаторов');
    raiseUrgency('medium');
  }

  // 2b. Стук в подвеске без фразы "на неровной дороге"
  if (
    (symptoms.includes('стук') || symptoms.includes('грохот')) &&
    (symptoms.includes('справа') || symptoms.includes('слева') || symptoms.includes('спереди'))
  ) {
    rulesMatched++;
    pushCause('Износ стоек/втулок стабилизатора');
    pushCause('Люфт шаровой опоры или рулевого наконечника');
    pushCause('Износ опоры амортизатора');
    pushCheck('Проверить подвеску на подъемнике с нагрузкой на шарниры и стойки');
    pushCheck('Проверить люфты рулевых наконечников и шаровых опор монтажкой');
    pushCheck('Оценить состояние опор амортизаторов и крепежа стойки');
    raiseUrgency('medium');
  }

  // 3. Троение двигателя
  if (
    symptoms.includes('двигатель троит') ||
    (symptoms.includes('троит') && !symptoms.includes('короб') && !symptoms.includes('передач'))
  ) {
    rulesMatched++;
    pushCause('Свечи зажигания');
    pushCause('Катушка зажигания');
    pushCause('Форсунки');
    pushCheck('Считать ошибки ЭБУ и оценить режимы форсунок по сканеру');
    pushCheck('Проверить свечи: зазор, изолятор, цвет нагара');
    pushCheck('Поменять свечи/катушки местами и сравнить работу цилиндров');
    raiseUrgency('medium');
  }

  // 3b. Пропуски на холостом / нестабильный холостой
  if (
    (symptoms.includes('пропуск') || symptoms.includes('пропуски')) &&
    (symptoms.includes('холост') || conditions.includes('холост'))
  ) {
    rulesMatched++;
    pushCause('Свечи зажигания');
    pushCause('Катушка зажигания');
    pushCause('Форсунки');
    pushCause('Подсос воздуха');
    pushCause('Дроссельная заслонка или датчики (ДПДЗ, ДХХ, MAF)');
    pushCheck('Считать стоп-кадр форсунок и коррекцию смеси по цилиндрам');
    pushCheck('Проверить разрежение на впуске и подсос на холостом (дымок/мыльный раствор)');
    pushCheck('Осмотреть и при необходимости очистить дроссель, проверить показания ДПДЗ');
    raiseUrgency('medium');
  }

  // 4. Не запускается + стартер / не схватывает (всё в симптомах)
  if (
    symptoms.includes('не запускается') &&
    (symptoms.includes('стартер') || symptoms.includes('не схватывает'))
  ) {
    rulesMatched++;
    pushCause('Отсутствие подачи топлива');
    pushCause('Неисправность системы зажигания');
    pushCause('Неисправность датчика положения коленчатого вала');
    pushCheck('Проверить давление топлива на рампе и работу бензонасоса при включении зажигания');
    pushCheck('Проверить искру на свече снятой катушки (осторожно, короткий тест)');
    pushCheck('Считать коды ЭБУ и проверить сигнал ДПКВ осциллографом/сканером при провороте');
    raiseUrgency('medium');
  }

  // 5. Плавают обороты
  if (symptoms.includes('плавают обороты')) {
    rulesMatched++;
    pushCause('Загрязнение дроссельной заслонки');
    pushCause('Подсос воздуха');
    pushCause('Неисправность датчика холостого хода или расходомера');
    pushCheck('Снять и промыть дроссельный узел, проверить прокладку');
    pushCheck('Продууть/опрыскать шланги впуска мыльным раствором на холостом — искать пузыри');
    pushCheck('Считать параметры ДПДЗ, ДХХ/MAF при прогреве');
    raiseUrgency('medium');
  }

  // 6. Перегрев
  if (symptoms.includes('перегрев')) {
    rulesMatched++;
    pushCause('Термостат');
    pushCause('Радиатор');
    pushCause('Помпа');
    pushCause('Утечка охлаждающей жидкости');
    pushCheck('Проверить уровень ОЖ в расширительном бачке при холодном двигателе');
    pushCheck('Проверить работу вентилятора и включение при прогреве (температура/диагностика)');
    pushCheck('Осмотреть патрубки, радиатор и помпу на подтёки; при необходимости — опрессовка');
    raiseUrgency('high');
  }

  // Критические ключи безопасности
  if (
    joined.includes('педаль тормоза') &&
    (joined.includes('провал') || joined.includes('не тормозит') || joined.includes('тормозит хуже'))
  ) {
    rulesMatched++;
    pushCause('Падение давления в тормозном контуре');
    pushCause('Утечка тормозной жидкости или неисправность главного тормозного цилиндра');
    pushCheck('Немедленно прекратить эксплуатацию и доставить автомобиль эвакуатором');
    pushCheck('Проверить герметичность контура и уровень тормозной жидкости');
    raiseUrgency('critical');
  }
  if (joined.includes('пар из-под капота') || joined.includes('дым из-под капота')) {
    rulesMatched++;
    pushCause('Критический перегрев силового агрегата или утечка рабочей жидкости');
    pushCheck('Остановиться в безопасном месте, заглушить двигатель, не открывать горячую крышку системы охлаждения');
    raiseUrgency('critical');
  }
  if (
    (joined.includes('запах') && joined.includes('бензин')) ||
    joined.includes('утечка топлива')
  ) {
    rulesMatched++;
    pushCause('Разгерметизация топливной магистрали');
    pushCheck('Прекратить эксплуатацию, исключить источники огня и организовать эвакуацию');
    raiseUrgency('critical');
  }
  if (joined.includes('давлен') && joined.includes('масл') && (joined.includes('красн') || joined.includes('горит'))) {
    rulesMatched++;
    pushCause('Критическое снижение давления масла в двигателе');
    pushCheck('Немедленно заглушить двигатель и не запускать до проверки системы смазки');
    raiseUrgency('critical');
  }

  // Доп. эвристика срочности по ключевым словам
  if (joined.includes('тормоз') || joined.includes('торможен')) raiseUrgency('high');
  if (joined.includes('перегрев') || joined.includes('кипит') || joined.includes('температур')) {
    raiseUrgency('high');
  }
  if (
    joined.includes('биение руля') ||
    joined.includes('люфт руля') ||
    (joined.includes('рулев') && (joined.includes('вибрац') || joined.includes('уводит')))
  ) {
    raiseUrgency('high');
  }
  if (
    joined.includes('сильн') &&
    (joined.includes('вибрац') || joined.includes('биен'))
  ) {
    raiseUrgency('high');
  }
  if (
    joined.includes('глохнет') ||
    joined.includes('заглох') ||
    (joined.includes('двигатель') && joined.includes('останов'))
  ) {
    raiseUrgency('high');
  }
  if (
    joined.includes('не тормозит') ||
    (joined.includes('рул') && joined.includes('не слушается')) ||
    (joined.includes('fire') || joined.includes('пожар'))
  ) {
    raiseUrgency('critical');
  }

  if (urgency === 'low') {
    if (
      joined.includes('плавают') ||
      joined.includes('троит') ||
      joined.includes('нестабильн') ||
      joined.includes('не запускается') ||
      joined.includes('не заводится')
    ) {
      raiseUrgency('medium');
    }
  }

  let confidenceBoost = 0;
  if (rulesMatched === 1) confidenceBoost = 0.08;
  else if (rulesMatched === 2) confidenceBoost = 0.16;
  else if (rulesMatched >= 3) confidenceBoost = 0.35;

  return {
    probable_causes: causes.slice(0, 5),
    recommended_checks: checks.slice(0, 5),
    urgency,
    confidenceBoost,
  };
}
