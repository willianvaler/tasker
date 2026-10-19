// Entrada do app: o Zod é configurado antes de qualquer módulo criar ou usar um esquema (D212);
// depois, a entrada normal do Expo Router.
import './src/lib/zod-config';
import 'expo-router/entry';
