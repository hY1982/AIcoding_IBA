import React, { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { ValidatedTextInput } from '@/components/form/ValidatedTextInput';
import { FormContainer } from '@/components/form/FormContainer';
import { authService } from '@/api/auth.service';
import { useAppStore } from '@/stores';
import { validatePhone, validatePassword } from '@/utils/validation';
import type { LoginScreenNavigationProp } from '@/navigation/types';

export function LoginScreen() {
  const navigation = useNavigation<LoginScreenNavigationProp>();
  const setToken = useAppStore((state) => state.setToken);
  const setUser = useAppStore((state) => state.setUser);

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [phoneError, setPhoneError] = useState<string | undefined>();
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [globalError, setGlobalError] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);

  const validateForm = (): boolean => {
    const phoneErr = validatePhone(phone);
    const passwordErr = validatePassword(password);
    setPhoneError(phoneErr || undefined);
    setPasswordError(passwordErr || undefined);
    return !phoneErr && !passwordErr;
  };

  const handleLogin = async () => {
    setGlobalError(undefined);
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      const response = await authService.login({ phone, password });
      await authService.saveTokens(response.tokens.accessToken, response.tokens.refreshToken);
      setToken(response.tokens.accessToken);
      setUser({
        id: response.user.id,
        nickname: response.user.nickname,
        userType: response.user.userType,
      });
      navigation.navigate('Profile');
    } catch (error) {
      const message = error instanceof Error ? error.message : '登录失败';
      setGlobalError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <FormContainer onSubmit={handleLogin} submitLabel="登录" isLoading={isLoading} error={globalError}>
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
    </FormContainer>
  );
}
