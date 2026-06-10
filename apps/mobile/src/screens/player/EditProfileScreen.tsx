import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ValidatedTextInput } from '@/components/form/ValidatedTextInput';
import { FormContainer } from '@/components/form/FormContainer';
import { playerService } from '@/api/player.service';
import { validatePlayerAge, validateHeight, validatePositions, validateOptionalPositiveNumber } from '@/utils/validation';
import { BASKETBALL_POSITIONS, POSITION_LABELS, GENDERS, GENDER_LABELS } from '@shared/player';
import type {
  EditProfileScreenNavigationProp,
  EditProfileScreenRouteProp,
} from '@/navigation/types';
import type { Gender, BasketballPosition } from '@shared/player';

export function EditProfileScreen() {
  const navigation = useNavigation<EditProfileScreenNavigationProp>();
  const route = useRoute<EditProfileScreenRouteProp>();
  const { profile } = route.params;

  const [age, setAge] = useState(String(profile.age));
  const [basketballAge, setBasketballAge] = useState(String(profile.basketballAge));
  const [gender, setGender] = useState<Gender>(profile.gender);
  const [height, setHeight] = useState(String(profile.height));
  const [weight, setWeight] = useState(profile.weight !== undefined ? String(profile.weight) : '');
  const [wingspan, setWingspan] = useState(profile.wingspan !== undefined ? String(profile.wingspan) : '');
  const [standingReach, setStandingReach] = useState(
    profile.standingReach !== undefined ? String(profile.standingReach) : '',
  );
  const [jumpingReach, setJumpingReach] = useState(
    profile.jumpingReach !== undefined ? String(profile.jumpingReach) : '',
  );
  const [positions, setPositions] = useState<BasketballPosition[]>(
    profile.positions.map((p) => p.position),
  );

  const [ageError, setAgeError] = useState<string | undefined>();
  const [heightError, setHeightError] = useState<string | undefined>();
  const [weightError, setWeightError] = useState<string | undefined>();
  const [wingspanError, setWingspanError] = useState<string | undefined>();
  const [standingReachError, setStandingReachError] = useState<string | undefined>();
  const [jumpingReachError, setJumpingReachError] = useState<string | undefined>();
  const [positionsError, setPositionsError] = useState<string | undefined>();
  const [globalError, setGlobalError] = useState<string | undefined>();
  const [successMessage, setSuccessMessage] = useState<string | undefined>();
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
    const weightErr = validateOptionalPositiveNumber(weight ? Number(weight) : undefined, '体重');
    const wingspanErr = validateOptionalPositiveNumber(wingspan ? Number(wingspan) : undefined, '臂展');
    const standingReachErr = validateOptionalPositiveNumber(standingReach ? Number(standingReach) : undefined, '站立摸高');
    const jumpingReachErr = validateOptionalPositiveNumber(jumpingReach ? Number(jumpingReach) : undefined, '起跳摸高');
    const positionsErr = positions.length === 0 ? '请至少选择一个位置' : validatePositions(positions);
    setAgeError(ageErr || undefined);
    setHeightError(heightErr || undefined);
    setWeightError(weightErr || undefined);
    setWingspanError(wingspanErr || undefined);
    setStandingReachError(standingReachErr || undefined);
    setJumpingReachError(jumpingReachErr || undefined);
    setPositionsError(positionsErr || undefined);
    return !ageErr && !heightErr && !weightErr && !wingspanErr && !standingReachErr && !jumpingReachErr && !positionsErr;
  };

  const handleSubmit = async () => {
    setGlobalError(undefined);
    setSuccessMessage(undefined);
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      await playerService.updateProfile({
        age: Number(age),
        basketballAge: Number(basketballAge) || 0,
        gender,
        height: Number(height),
        weight: weight ? Number(weight) : undefined,
        wingspan: wingspan ? Number(wingspan) : undefined,
        standingReach: standingReach ? Number(standingReach) : undefined,
        jumpingReach: jumpingReach ? Number(jumpingReach) : undefined,
        positions,
      });
      setSuccessMessage('资料更新成功');
      navigation.goBack();
    } catch (error) {
      const message = error instanceof Error ? error.message : '更新失败';
      setGlobalError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <FormContainer
      onSubmit={handleSubmit}
      submitLabel="保存"
      isLoading={isLoading}
      error={globalError}
      success={successMessage}
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
        onChangeText={(text) => {
          setWeight(text);
          setWeightError(undefined);
        }}
        placeholder="请输入体重"
        keyboardType="numeric"
        error={weightError}
        accessibilityLabel="体重输入框"
      />
      <ValidatedTextInput
        label="臂展（cm，可选）"
        value={wingspan}
        onChangeText={(text) => {
          setWingspan(text);
          setWingspanError(undefined);
        }}
        placeholder="请输入臂展"
        keyboardType="numeric"
        error={wingspanError}
        accessibilityLabel="臂展输入框"
      />
      <ValidatedTextInput
        label="站立摸高（cm，可选）"
        value={standingReach}
        onChangeText={(text) => {
          setStandingReach(text);
          setStandingReachError(undefined);
        }}
        placeholder="请输入站立摸高"
        keyboardType="numeric"
        error={standingReachError}
        accessibilityLabel="站立摸高输入框"
      />
      <ValidatedTextInput
        label="起跳摸高（cm，可选）"
        value={jumpingReach}
        onChangeText={(text) => {
          setJumpingReach(text);
          setJumpingReachError(undefined);
        }}
        placeholder="请输入起跳摸高"
        keyboardType="numeric"
        error={jumpingReachError}
        accessibilityLabel="起跳摸高输入框"
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
