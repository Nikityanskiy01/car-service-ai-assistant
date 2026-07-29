import { Siren } from 'lucide-react';

export function CriticalSafetyBanner() {
  return (
    <div className="critical-safety-banner" role="alert">
      <Siren size={20} aria-hidden="true" />
      <div>
        <strong>Критическая неисправность</strong>
        <p>
          По симптомам возможна опасная ситуация. Рекомендуем прекратить эксплуатацию автомобиля и организовать
          доставку в сервис эвакуатором.
        </p>
      </div>
    </div>
  );
}
