import React, { useState } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ValidatedTextInput } from '@/components/form/ValidatedTextInput';
import { FormContainer } from '@/components/form/FormContainer';
import { validatePhone, validatePassword, validateNickname } from '@/utils/validation';
import type { RegisterScreenNavigationProp, RegisterScreenRouteProp } from '@/navigation/types';

export function RegisterScreen() {
  const navigation = useNavigation<RegisterScreenNavigationProp>();
  const route = useRoute<RegisterScreenRouteProp>();
  const { userType } = route.params;

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [phoneError, setPhoneError] = useState<string | undefined>();
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [nicknameError, setNicknameError] = useState<string | undefined>();

  const validateForm = (): boolean => {
    const phoneErr = validatePhone(phone);
    const passwordErr = validatePassword(password);
    const nicknameErr = validateNickname(nickname);
    setPhoneError(phoneErr || undefined);
    setPasswordError(passwordErr || undefined);
    setNicknameError(nicknameErr || undefined);
    return !phoneErr && !passwordErr && !nicknameErr;
  };

  const handleNext = () => {
    if (!validateForm()) return;

    const nextScreen = userType === 'player' ? 'PlayerRegister' : 'VenueManagerRegister';
    navigation.navigate(nextScreen, {
      phone,
      password,
      nickname,
    });
  };

  return (
    <FormContainer onSubmit={handleNext} submitLabel="下一步">
      <ValidatedTextInput
        label="手机号"
        value={phone}
        onChangeText={(text) => {
          setPhone(text);
          setPhoneError(undefined);
        }}
        placeholder="请输入手机号"
        keyboardType="phone-pad"
        error={phoneError}
        accessibilityLabel="手机号输入框"
      />
      <ValidatedTextInput
        label="密码"
        value={password}
        onChangeText={(text) => {
          setPassword(text);
          setPasswordError(undefined);
        }}
        placeholder="请输入密码"
        secureTextEntry
        error={passwordError}
        accessibilityLabel="密码输入框"
      />
      <ValidatedTextInput
        label="昵称"
        value={nickname}
        onChangeText={(text) => {
          setNickname(text);
          setNicknameError(undefined);
        }}
        placeholder="请输入昵称"
        error={nicknameError}
        accessibilityLabel="昵称输入框"
      />
    </FormContainer>
  );
}
