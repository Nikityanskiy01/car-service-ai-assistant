import { Button } from './Button';
import { Modal } from './Modal';

export function ConfirmDialog({
  open,
  title,
  text,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  text: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal open={open} title={title} onClose={onCancel}>
      <p>{text}</p>
      <div className="row gap-sm">
        <Button variant="ghost" onClick={onCancel}>
          Отмена
        </Button>
        <Button variant="danger" onClick={onConfirm}>
          Подтвердить
        </Button>
      </div>
    </Modal>
  );
}
