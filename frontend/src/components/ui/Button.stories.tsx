import { Button } from './Button';

const meta = {
  title: 'UI/Button',
  component: Button,
};

export default meta;

export const Primary = { args: { children: 'Записаться', variant: 'primary' as const } };
export const Ghost = { args: { children: 'Отмена', variant: 'ghost' as const } };
