// Raízes do Let's Encrypt dentro do APK (D215). O certificado do tasker.wavdev.org vem da cadeia
// nova do Let's Encrypt (YE1 → Root YE → ISRG Root X2 → ISRG Root X1, só ECDSA): celular com o
// repositório de raízes antigo (Android 7.0 não tem o X1; vários não têm X2 nem Root YE) falhava
// no handshake. Com estas raízes como âncoras extras, a cadeia fecha em qualquer Android 7+. As
// raízes do sistema continuam valendo. Certificados em assets/certs (baixados de letsencrypt.org).
const fs = require('fs');
const path = require('path');
const { withAndroidManifest, withDangerousMod } = require('expo/config-plugins');

const CERTS = ['isrg_root_x1', 'isrg_root_x2', 'isrg_root_ye'];

// Release: só HTTPS (como já era). Debug (development build): HTTP liberado, para o Metro e o
// Supabase pela rede local, como o usesCleartextTraffic que o Expo põe no debug (que a
// networkSecurityConfig passaria a ignorar)
const xml = (cleartext) => `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <base-config cleartextTrafficPermitted="${cleartext}">
    <trust-anchors>
      <certificates src="system" />
${CERTS.map((c) => `      <certificates src="@raw/${c}" />`).join('\n')}
    </trust-anchors>
  </base-config>
</network-security-config>
`;

function withTrustedRoots(config) {
  config = withDangerousMod(config, [
    'android',
    (cfg) => {
      const src = path.join(cfg.modRequest.platformProjectRoot, 'app', 'src');
      const res = path.join(src, 'main', 'res');
      fs.mkdirSync(path.join(res, 'raw'), { recursive: true });
      fs.mkdirSync(path.join(res, 'xml'), { recursive: true });
      fs.mkdirSync(path.join(src, 'debug', 'res', 'xml'), { recursive: true });
      for (const c of CERTS)
        fs.copyFileSync(
          path.join(cfg.modRequest.projectRoot, 'assets', 'certs', `${c}.crt`),
          path.join(res, 'raw', `${c}.crt`),
        );
      fs.writeFileSync(path.join(res, 'xml', 'network_security_config.xml'), xml(false));
      fs.writeFileSync(
        path.join(src, 'debug', 'res', 'xml', 'network_security_config.xml'),
        xml(true),
      );
      return cfg;
    },
  ]);
  return withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application?.[0];
    if (app) app.$['android:networkSecurityConfig'] = '@xml/network_security_config';
    return cfg;
  });
}

module.exports = withTrustedRoots;
