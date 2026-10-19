import { LegalPage } from '@/components/legal-page';

// Política de privacidade (V5 §4, D213). Pública (fora do login): as lojas pedem um endereço para ela.
export default function PrivacyScreen() {
  return <LegalPage doc="privacy" />;
}
