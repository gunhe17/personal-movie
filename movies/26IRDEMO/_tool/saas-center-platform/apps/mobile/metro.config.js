// Learn more https://docs.expo.io/guides/customizing-metro
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

// pnpm 모노레포: 루트 node_modules도 감시 대상에 추가
config.watchFolders = [monorepoRoot];

// 모듈 해석 경로: 프로젝트 → 루트 순서로 탐색
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Zustand v5 ESM 빌드(.mjs)가 import.meta.env를 사용하여
// Metro 웹 번들에서 SyntaxError 발생.
// .mjs 확장자를 sourceExts에서 제거하여 CJS(.js)가 선택되도록 강제.
config.resolver.sourceExts = config.resolver.sourceExts.filter(
  (ext) => ext !== 'mjs',
);

// SVG를 React 컴포넌트로 import 가능하게 변환
// assets/icons/*.svg → <Icon /> 형태로 사용
config.transformer.babelTransformerPath = require.resolve(
  'react-native-svg-transformer/expo',
);
config.resolver.assetExts = config.resolver.assetExts.filter((ext) => ext !== 'svg');
config.resolver.sourceExts.push('svg');

module.exports = withNativeWind(config, { input: './global.css' });
