import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ValidatedTextInput } from '@/components/form/ValidatedTextInput';
import { FormContainer } from '@/components/form/FormContainer';
import { authService } from '@/api/auth.service';
import { useAppStore } from '@/stores';
import { validatePlayerAge, validateHeight, validatePositions } from '@/utils/validation';
import { BASKETBALL_POSITIONS, POSITION_LABELS, GENDERS, GENDER_LABELS } from '@shared/player';
import type {
  PlayerRegisterScreenNavigationProp,
  PlayerRegisterScreenRouteProp,
} from '@/navigation/types';
import type { Gender, BasketballPosition } from '@shared/player';

export function PlayerRegisterScreen() {
  const navigation = useNavigation<PlayerRegisterScreenNavigationProp>();
  const route = useRoute<PlayerRegisterScreenRouteProp>();
  const { phone, password, nickname } = route.params;
  const setToken = useAppStore((state) => state.setToken);
  const setUser = useAppStore((state) => state.setUser);

  const [age, setAge] = useState('');
  const [basketballAge, setBasketballAge] = useState('');
  const [gender, setGender] = useState<Gender | undefined>(undefined);
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [positions, setPositions] = useState<BasketballPosition[]>([]);
  const [ageError, setAgeError] = useState<string | undefined>();
  const [heightError, setHeightError] = useState<string | undefined>();
  const [positionsError, setPositionsError] = useState<string | undefined>();
  const [globalError, setGlobalError] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);

  const togglePosition = (pos: BasketballPosition) => {
    setPositions((prev) => {
      if (prev.includes(pos)) {
        return prev.filter((p) => p !== pos);
      }
      if (prev.length >= 3) return prev;
      return [...prev, pos];
    });
    setPositionsError(undefined);
  };

  const validateForm = (): boolean => {
    const ageErr = validatePlayerAge(Number(age));
    const heightErr = validateHeight(Number(height));
    const positionsErr = positions.length === 0 ? '请至少选择一个位置' : validatePositions(positions);
    setAgeError(ageErr || undefined);
    setHeightError(heightErr || undefined);
    setPositionsError(positionsErr || undefined);
    return !ageErr && !heightErr && !positionsErr && !!gender;
  };

  const handleRegister = async () => {
    setGlobalError(undefined);
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      const response = await authService.register({
        phone,
        password,
        nickname,
        userType: 'player',
        age: Number(age),
        basketballAge: Number(basketballAge) || 0,
        gender: gender!,
        height: Number(height),
        weight: weight ? Number(weight) : undefined,
        positions: positions.length > 0 ? positions : undefined,
      });
      await authService.saveTokens(response.tokens.accessToken, response.tokens.refreshToken);
      setToken(response.tokens.accessToken);
      setUser({
        id: response.user.id,
        nickname: response.user.nickname,
        userType: response.user.userType,
      });
      navigation.navigate('Home');
    } catch (error) {
      const message = error instanceof Error ? error.message : '注册失败';
      setGlobalError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <FormContainer
      onSubmit={handleRegister}
      submitLabel="注册"
      isLoading={isLoading}
      error={globalError}
    >
      <ValidatedTextInput
        label="年龄"
        value={age}
        onChangeText={(text) => {
          setAge(text);
          setAgeError(undefined);
        }}
        placeholder="请输入年龄"
        keyboardType="numeric"
        error={ageError}
        accessibilityLabel="年龄输入框"
      />
      <ValidatedTextInput
        label="球龄（年）"
        value={basketballAge}
        onChangeText={setBasketballAge}
        placeholder="请输入球龄"
        keyboardType="numeric"
        accessibilityLabel="球龄输入框"
      />

      <Text style={styles.sectionLabel} accessibilityRole="header">
        性别
      </Text>
      <View style={styles.row}>
        {GENDERS.map((g) => (
          <TouchableOpacity
            key={g}
            style={[styles.chip, gender === g ? styles.chipActive : null]}
            onPress={() => setGender(g)}
            accessibilityLabel={GENDER_LABELS[g]}
            accessibilityRole="radio"
            accessibilityState={{ checked: gender === g }}
          >
            <Text style={gender === g ? styles.chipTextActive : styles.chipText}>
              {GENDER_LABELS[g]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ValidatedTextInput
        label="身高（cm）"
        value={height}
        onChangeText={(text) => {
          setHeight(text);
          setHeightError(undefined);
        }}
        placeholder="请输入身高"
        keyboardType="numeric"
        error={heightError}
        accessibilityLabel="身高输入框"
      />
      <ValidatedTextInput
        label="体重（kg，可选）"
        value={weight}
        onChangeText={setWeight}
        placeholder="请输入体重"
        keyboardType="numeric"
        accessibilityLabel="体重输入框"
      />

      <Text style={styles.sectionLabel} accessibilityRole="header">
        位置（最多3个）
      </Text>
      {positionsError ? (
        <Text style={styles.errorText} accessibilityLiveRegion="assertive">
          {positionsError}
        </Text>
      ) : null}
      <View style={styles.rowWrap}>
        {BASKETBALL_POSITIONS.map((pos) => (
          <TouchableOpacity
            key={pos}
            style={[styles.chip, positions.includes(pos) ? styles.chipActive : null]}
            onPress={() => togglePosition(pos)}
            accessibilityLabel={POSITION_LABELS[pos]}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: positions.includes(pos) }}
          >
            <Text style={positions.includes(pos) ? styles.chipTextActive : styles.chipText}>
              {POSITION_LABELS[pos]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </FormContainer>
  );
}

const styles = StyleSheet.create({
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginTop: 8,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  chipActive: {
    backgroundColor: '#3498db',
    borderColor: '#3498db',
  },
  chipText: {
    color: '#333',
    fontSize: 14,
  },
  chipTextActive: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  errorText: {
    color: '#e74c3c',
    fontSize: 12,
    marginBottom: 8,
  },
});
