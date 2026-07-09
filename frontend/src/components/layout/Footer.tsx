import { productConfig } from '../../config/productConfig';

export function Footer() {
  return (
    <footer className="footer">
      <p>{productConfig.footerCaption}</p>
    </footer>
  );
}
