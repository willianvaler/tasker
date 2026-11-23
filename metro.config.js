const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);
// pdf.js do leitor de PDF no celular (assets/pdfjs/*.txt): arquivo, não código (D329)
config.resolver.assetExts.push('txt');

module.exports = withNativeWind(config, { input: './src/global.css' });
