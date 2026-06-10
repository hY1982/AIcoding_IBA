import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRoute } from '@react-navigation/native';
import type { AbilityScreenRouteProp } from '@/navigation/types';
import type { PlayerAbility } from '@shared/player';

export interface AbilityScreenProps {
  ability?: PlayerAbility;
}

export function AbilityScreen({ ability }: AbilityScreenProps) {
  if (!ability) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyText}>暂无能力值数据</Text>
      </View>
    );
  }

  const { baseAbilityScore, matchAdjustValue, totalAbilityScore } = ability;
  const adjustSign = matchAdjustValue >= 0 ? '+' : '';

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>能力值详情</Text>
      </View>

      <View style={styles.scoreCard} accessibilityLabel="基础能力值">
        <Text style={styles.scoreLabel}>基础能力值</Text>
        <Text style={styles.scoreValue}>{String(baseAbilityScore.toFixed(1))}</Text>
        <Text style={styles.scoreDescription}>
          根据您的身体属性（身高、体重、臂展等）计算得出的百分位评分
        </Text>
      </View>

      <View style={styles.scoreCard} accessibilityLabel="比赛调节值">
        <Text style={styles.scoreLabel}>比赛调节值</Text>
        <Text
          style={[
            styles.scoreValue,
            matchAdjustValue >= 0 ? styles.positiveValue : styles.negativeValue,
          ]}
        >
          {adjustSign}
          {String(matchAdjustValue.toFixed(1))}
        </Text>
        <Text style={styles.scoreDescription}>
          根据其他球员对您赛后反馈计算得出的调节值，范围 -50 ~ +50
        </Text>
      </View>

      <View style={[styles.scoreCard, styles.totalCard]} accessibilityLabel="综合能力值">
        <Text style={styles.scoreLabel}>综合能力值</Text>
        <Text style={[styles.scoreValue, styles.totalValue]}>{String(totalAbilityScore.toFixed(1))}</Text>
        <Text style={styles.scoreDescription}>基础能力值 + 比赛调节值 = 综合能力值</Text>
        <Text style={styles.formula}>
          {String(baseAbilityScore.toFixed(1))} {adjustSign}
          {String(matchAdjustValue.toFixed(1))} = {String(totalAbilityScore.toFixed(1))}
        </Text>
      </View>

      <View style={styles.infoSection}>
        <Text style={styles.infoTitle}>说明</Text>
        <Text style={styles.infoText}>
          基础能力值根据您在注册时填写的身体属性（身高、体重、臂展、站立摸高、起跳摸高、球龄、年龄）计算得出，
          使用百分位评分系统（0-100分）。
        </Text>
        <Text style={styles.infoText}>
          比赛调节值根据赛后其他球员对您的反馈（水平匹配、体育道德、动作干净程度、守时情况）动态调整，
          用于更准确地反映您的实际比赛表现。
        </Text>
      </View>
    </ScrollView>
  );
}

export function AbilityScreenContainer() {
  const route = useRoute<AbilityScreenRouteProp>();
  const ability = route.params?.ability;
  return <AbilityScreen ability={ability} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
  header: {
    backgroundColor: '#3498db',
    paddingVertical: 24,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
  },
  scoreCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 12,
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  totalCard: {
    borderWidth: 2,
    borderColor: '#3498db',
  },
  scoreLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  scoreValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    paddingRight: 4,
  },
  positiveValue: {
    color: '#27ae60',
  },
  negativeValue: {
    color: '#e74c3c',
  },
  totalValue: {
    color: '#3498db',
  },
  scoreDescription: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    lineHeight: 18,
  },
  formula: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    fontWeight: '500',
    paddingRight: 4,
  },
  infoSection: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 24,
    padding: 16,
    borderRadius: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 13,
    color: '#666',
    lineHeight: 20,
    marginBottom: 8,
  },
});
