import type { PhotoObservations } from '../../types/consultation';

type Props = {
  photoObservations?: PhotoObservations | null;
  messageContents?: string[];
};

function extractImageUrls(text: string) {
  const matches = text.match(/https?:\/\/[^\s)]+\.(?:jpg|jpeg|png|webp|gif)/gi);
  return matches || [];
}

export function ConsultationPhotoGallery({ photoObservations, messageContents = [] }: Props) {
  const urls = new Set<string>();
  for (const content of messageContents) {
    for (const url of extractImageUrls(content)) urls.add(url);
  }

  const observations = photoObservations?.observations || [];
  const hasContent = urls.size > 0 || observations.length > 0 || photoObservations?.summary;

  if (!hasContent) return null;

  return (
    <section className="consultation-photo-gallery stack">
      <h3>Фото и наблюдения</h3>
      {photoObservations?.summary ? <p className="muted">{photoObservations.summary}</p> : null}
      {observations.length ? (
        <ul className="photo-observations-list">
          {observations.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
      {urls.size ? (
        <div className="photo-gallery-grid">
          {[...urls].map((url) => (
            <figure key={url}>
              <img src={url} alt="Фото от клиента" loading="lazy" />
            </figure>
          ))}
        </div>
      ) : null}
    </section>
  );
}
