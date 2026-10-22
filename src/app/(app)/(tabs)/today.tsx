import { Redirect } from 'expo-router';

// A Hoje virou a tela de abertura (D258, `/`); endereços e atalhos antigos caem nela.
export default function TodayRedirect() {
  return <Redirect href="/" />;
}
