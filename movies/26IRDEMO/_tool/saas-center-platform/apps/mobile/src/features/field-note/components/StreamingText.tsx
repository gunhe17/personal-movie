import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import RAnimated, { FadeIn } from 'react-native-reanimated';
import type { TextStyle, ViewStyle } from 'react-native';

const WORD_DELAY_MS = 60;
const WORD_FADE_DURATION_MS = 200;

interface StreamingTextProps {
  text: string;
  chunkIndex: number;
  animatedChunksRef: React.MutableRefObject<Set<number>>;
  textStyle?: TextStyle;
  wrapStyle?: ViewStyle;
}

export function StreamingText({
  text,
  chunkIndex,
  animatedChunksRef,
  textStyle,
  wrapStyle,
}: StreamingTextProps) {
  // 이미 애니메이션을 마친 청크(또는 가상화로 화면 밖→재마운트된 청크)는 평문으로 즉시 렌더.
  const alreadyAnimated = animatedChunksRef.current.has(chunkIndex);
  const [animating, setAnimating] = useState(!alreadyAnimated);

  useEffect(() => {
    if (alreadyAnimated) return;
    animatedChunksRef.current.add(chunkIndex);
    // 단어 stagger 가 끝나면 평문 <Text> 로 collapse.
    // 녹음이 길어질수록 청크별 Animated.Text 노드가 영구히 누적되어
    // 메인 스레드가 포화되던 문제(전사 지연 증가)의 핵심 원인을 제거.
    const wordCount = text.trim().length === 0 ? 1 : text.trim().split(/\s+/).length;
    const animationTotalMs = wordCount * WORD_DELAY_MS + WORD_FADE_DURATION_MS;
    const timer = setTimeout(() => setAnimating(false), animationTotalMs + 50);
    return () => clearTimeout(timer);
    // chunkIndex 단위로 1회만 실행. (collapse 이후 text 갱신은 평문이라 안전)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chunkIndex]);

  if (!animating) {
    return <Text style={textStyle}>{text}</Text>;
  }

  const words = text.split(' ');

  return (
    <View style={[styles.wordWrap, wrapStyle]}>
      {words.map((word, i) => (
        <RAnimated.Text
          key={i}
          entering={FadeIn.duration(WORD_FADE_DURATION_MS).delay(i * WORD_DELAY_MS)}
          style={textStyle}
        >
          {word}
          {i < words.length - 1 ? ' ' : ''}
        </RAnimated.Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wordWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
