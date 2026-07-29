import { siteImages } from '../../content/siteImages';
import type { ServiceItem } from './types';

export const fallbackServices: ServiceItem[] = [
  {
    id: 'fs1',
    title: 'Компьютерная диагностика',
    description: 'Считывание ошибок ЭБУ, проверка датчиков и отчёт по кодам.',
    price: 'от 2 000 ₽',
    category: 'Диагностика',
    imageUrl: siteImages.works.diagnostics,
  },
  {
    id: 'fs2',
    title: 'Диагностика тормозной системы',
    description: 'Диски, колодки, суппорты и шланги с фиксацией результата.',
    price: 'от 2 500 ₽',
    category: 'Тормозная система',
    imageUrl: siteImages.works.brakes,
  },
  {
    id: 'fs3',
    title: 'Ремонт подвески',
    description: 'Стойки, рычаги, сайлентблоки и проверка на яме.',
    price: 'от 4 500 ₽',
    category: 'Подвеска',
    imageUrl: siteImages.works.suspension,
  },
  {
    id: 'fs4',
    title: 'Развал-схождение',
    description: 'Компьютерная регулировка углов после ремонта ходовой.',
    price: 'от 3 200 ₽',
    category: 'Подвеска',
    imageUrl: siteImages.gallery.alignment,
  },
  {
    id: 'fs5',
    title: 'Плановое ТО',
    description: 'Масла, фильтры и жидкости по регламенту производителя.',
    price: 'от 3 900 ₽',
    category: 'ТО',
    imageUrl: siteImages.works.service,
  },
  {
    id: 'fs6',
    title: 'Диагностика и ремонт АКПП',
    description: 'Давление, адаптация, замена масла и фильтров.',
    price: 'от 5 500 ₽',
    category: 'Трансмиссия',
    imageUrl: siteImages.works.transmission,
  },
  {
    id: 'fs7',
    title: 'Автоэлектрика',
    description: 'Утечки тока, проводка и диагностика блоков.',
    price: 'от 2 800 ₽',
    category: 'Электрика',
    imageUrl: siteImages.works.electrics,
  },
  {
    id: 'fs8',
    title: 'Диагностика двигателя',
    description: 'Компрессия, эндоскопия и анализ шума ДВС.',
    price: 'от 3 500 ₽',
    category: 'Двигатель',
    imageUrl: siteImages.works.diagnostics,
  },
  {
    id: 'fs9',
    title: 'Заправка кондиционера',
    description: 'Проверка герметичности, вакуум и заправка фреоном.',
    price: 'от 4 200 ₽',
    category: 'Кондиционер',
    imageUrl: siteImages.gallery.tools,
  },
  {
    id: 'fs10',
    title: 'Шиномонтаж и балансировка',
    description: 'Сезонная перекидка, ремонт проколов, балансировка.',
    price: 'от 1 800 ₽',
    category: 'ТО',
    imageUrl: siteImages.gallery.alignment,
  },
  {
    id: 'fs11',
    title: 'Предпродажный осмотр',
    description: 'Комплексная проверка авто с письменным чек-листом.',
    price: 'от 3 000 ₽',
    category: 'Диагностика',
    imageUrl: siteImages.gallery.bay,
  },
  {
    id: 'fs12',
    title: 'ИИ-консультация + запись',
    description: 'Онлайн-разбор симптомов с передачей отчёта мастеру.',
    price: 'бесплатно',
    category: 'Диагностика',
    imageUrl: siteImages.gallery.reception,
  },
];

export const serviceHighlights = [
  { value: '12+', label: 'услуг в каталоге' },
  { value: '8', label: 'направлений ремонта' },
  { value: 'от 30 мин', label: 'среднее время диагностики' },
  { value: '0 ₽', label: 'ИИ-консультация' },
];

export const serviceProcess = [
  {
    step: '01',
    title: 'Выберите услугу',
    text: 'Найдите нужную работу в каталоге или воспользуйтесь поиском по симптомам.',
  },
  {
    step: '02',
    title: 'Запишитесь онлайн',
    text: 'Укажите удобное время — регистрация не обязательна, данные сохранятся в заявке.',
  },
  {
    step: '03',
    title: 'Приезжайте на пост',
    text: 'Мастер получит контекст заранее и сразу приступит к диагностике или ремонту.',
  },
];
