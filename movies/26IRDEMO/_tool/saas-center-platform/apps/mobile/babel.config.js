module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    // react-native-worklets/plugin은 react-native-reanimated 4.x를 위한 worklet 변환 플러그인.
    // 반드시 plugins 배열 마지막에 위치해야 함.
    plugins: ['react-native-worklets/plugin'],
  };
};
