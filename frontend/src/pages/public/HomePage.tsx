import { ArrowRight, BrainCircuit, ClipboardList, Gauge, LayoutDashboard, MessageSquare, ShieldCheck, Wrench } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { productConfig } from '../../config/productConfig';
import { usePageMeta } from '../../hooks/usePageMeta';

export function HomePage() {
  usePageMeta({
    title: 'ИИ-ассистент для первичной консультации клиентов автосервиса',
    description:
      'Платформа автоматизирует первичное общение с клиентом: сбор данных, интеллектуальный анализ, формирование заявки и работу менеджера.',
  });

  return (
    <div className="landing">
      <section className="hero hero-commercial">
        <div>
          <p className="hero-kicker">{productConfig.shortName} SaaS</p>
          <h1>ИИ-ассистент для первичной консультации клиентов автосервиса</h1>
          <p>
            Система собирает информацию об автомобиле, уточняет симптомы, формирует предварительный результат и
            автоматически создаёт структурированную заявку для менеджера.
          </p>
          <div className="row gap-sm hero-actions">
            <Link className="btn btn-primary" to="/consult">
              Попробовать консультацию
            </Link>
            <Link className="btn btn-ghost" to="/dashboard/manager">
              Посмотреть возможности
            </Link>
          </div>
        </div>
        <div className="hero-preview">
          <Card>
            <h3>Диалог с ассистентом</h3>
            <p>Клиент: «Вибрация при торможении на скорости»</p>
            <p>Ассистент: «Уточните пробег и когда проявляется симптом»</p>
            <small>Статус: анализ данных в процессе</small>
          </Card>
          <Card>
            <h3>Сформированная заявка</h3>
            <p>Camry 2018, 132 000 км</p>
            <p>Возможная причина: износ тормозных дисков</p>
            <small>Приоритет: высокий · Стоимость: от 6 000 ₽</small>
          </Card>
        </div>
      </section>

      <section className="landing-section">
        <h2>Проблемы текущего процесса</h2>
        <div className="grid three">
          {[
            'Менеджеры тратят время на повторяющиеся вопросы.',
            'Обращения поступают в свободной форме, важные данные теряются.',
            'Качество первичной консультации зависит от конкретного сотрудника.',
            'Заявки часто содержат неполные или несвязные данные.',
            'Клиент может долго ждать обратной связи.',
            'Нет единого интерфейса для контроля обращений и статусов.',
          ].map((item) => (
            <Card key={item}>
              <p>{item}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="landing-section">
        <h2>Как работает система</h2>
        <ol className="steps-line">
          {[
            'Клиент описывает проблему.',
            'Ассистент уточняет сведения об автомобиле.',
            'Система анализирует обращение.',
            'Формируется предварительный результат.',
            'Создаётся заявка менеджеру.',
            'Менеджер продолжает работу с клиентом.',
          ].map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>

      <section className="landing-section">
        <h2>Возможности продукта</h2>
        <div className="feature-grid">
          <Feature icon={<MessageSquare size={18} />} title="Интеллектуальная консультация" />
          <Feature icon={<BrainCircuit size={18} />} title="Анализ свободного текста" />
          <Feature icon={<ClipboardList size={18} />} title="Автоматическое создание заявки" />
          <Feature icon={<Wrench size={18} />} title="Учет рекомендаций и проверок" />
          <Feature icon={<LayoutDashboard size={18} />} title="Кабинет менеджера и канбан" />
          <Feature icon={<Gauge size={18} />} title="Контроль статусов и показателей" />
          <Feature icon={<ShieldCheck size={18} />} title="Роли, права и аудит" />
          <Feature icon={<ArrowRight size={18} />} title="Адаптация под конкретный сервис" />
        </div>
      </section>

      <section className="landing-section">
        <h2>Демонстрация интерфейсов</h2>
        <div className="grid three">
          <PreviewCard title="Консультация клиента" subtitle="Диалог, сбор данных, потоковый ответ" to="/consult" />
          <PreviewCard title="Результат анализа" subtitle="Причины, срочность, стоимость" to="/consult" />
          <PreviewCard title="Кабинет менеджера" subtitle="Канбан и карточка обращения" to="/dashboard/manager" />
          <PreviewCard title="Карточка заявки" subtitle="История, статус, действия" to="/dashboard/manager" />
          <PreviewCard title="Административная панель" subtitle="Роли, контент, аудит" to="/dashboard/admin" />
          <PreviewCard title="Аналитика" subtitle="KPI, динамика, загрузка" to="/dashboard/admin" />
        </div>
      </section>

      <section className="landing-section">
        <h2>Выгоды для автосервиса</h2>
        <div className="grid two">
          {[
            'Сокращение времени первичной обработки обращений.',
            'Унификация сбора данных по автомобилю и симптомам.',
            'Снижение нагрузки на менеджеров и операторов.',
            'Повышение качества заполнения заявок.',
            'Работа с обращениями в одном интерфейсе.',
            'Накопление структурированных данных для аналитики.',
          ].map((benefit) => (
            <Card key={benefit}>
              <p>{benefit}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="cta-banner">
        <h2>Готово к демонстрации и адаптации под ваш автосервис</h2>
        <p>Запустите консультацию, откройте менеджерский кабинет и посмотрите полный цикл обработки обращения.</p>
        <div className="row gap-sm">
          <Link className="btn btn-primary" to="/consult">
            Запустить демонстрационную консультацию
          </Link>
          <Link className="btn btn-ghost" to="/dashboard/manager">
            Открыть демонстрационный кабинет
          </Link>
        </div>
      </section>
    </div>
  );
}

function Feature({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <article className="feature-item">
      <span>{icon}</span>
      <p>{title}</p>
    </article>
  );
}

function PreviewCard({ title, subtitle, to }: { title: string; subtitle: string; to: string }) {
  return (
    <Link className="preview-card" to={to}>
      <h3>{title}</h3>
      <p>{subtitle}</p>
      <span>Открыть экран</span>
    </Link>
  );
}
