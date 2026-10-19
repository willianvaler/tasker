import { Redirect, useLocalSearchParams } from 'expo-router';

/** Endereço antigo de um artigo (F1): a Ajuda agora abre o artigo no lugar, na lista (D188). */
export default function HelpArticleRedirect() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  return <Redirect href={{ pathname: '/ajuda', params: { artigo: slug } }} />;
}
