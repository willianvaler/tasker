import { Search } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { useCommandPalette } from '@/components/command-palette';
import { IconButton } from '@/components/ui/button';

/**
 * Busca no topo das telas do celular (D258): abre a mesma paleta do Ctrl+K, que antes só existia
 * para quem tinha teclado. Acha páginas, pastas, telas e ações.
 */
export function SearchButton() {
  const { t } = useTranslation();
  const open = useCommandPalette();
  return <IconButton icon={Search} label={t('palette.open')} tone="ink" onPress={open} />;
}
