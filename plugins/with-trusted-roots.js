// Raízes do Let's Encrypt dentro do APK (D215). O certificado do questlist.wavdev.org vem da cadeia
// nova do Let's Encrypt (YE1 → Root YE → ISRG Root X2 → ISRG Root X1, só ECDSA): celular com o
// repositório de raízes antigo (Android 7.0 não tem o X1; vários não têm X2 nem Root YE) falhava
// no handshake. Com estas raízes como âncoras extras, a cadeia fecha em qualquer Android 7+. As
// raízes do sistema continuam valendo. Certificados em assets/certs (baixados de letsencrypt.org).
// 20/10: alguns celulares seguiam com "Trust anchor for certification path not found" mesmo com as
// raízes (não montam a cadeia cruzada Root YE ← X2 ← X1). Os intermediários em uso (YE1–3, YR1–3 da
// geração nova e E5–E9, R10–R14) entram também como âncoras: a folha fecha direto no intermediário.
const fs = require('fs');
const path = require('path');
const { withAndroidManifest, withDangerousMod } = require('expo/config-plugins');

const INTERMEDIATES = [
  'ye1',
  'ye2',
  'ye3',
  'yr1',
  'yr2',
  'yr3',
  'e5',
  'e6',
  'e7',
  'e8',
  'e9',
  'r10',
  'r11',
  'r12',
  'r13',
  'r14',
];
const CERTS = [
  'isrg_root_x1',
  'isrg_root_x2',
  'isrg_root_ye',
  'isrg_root_yr',
  ...INTERMEDIATES.map((n) => `le_int_${n}`),
];

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
