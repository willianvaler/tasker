import { Redirect } from 'expo-router';

// O Perfil virou Configurações (D257); endereços antigos (favoritos, avisos) caem lá.
export default function ProfileRedirect() {
  return <Redirect href="/configuracoes" />;
}
