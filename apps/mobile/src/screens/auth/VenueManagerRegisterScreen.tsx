import React, { useState } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ValidatedTextInput } from '@/components/form/ValidatedTextInput';
import { FormContainer } from '@/components/form/FormContainer';
import { authService } from '@/api/auth.service';
import { useAppStore } from '@/stores';
import { validateCompanyName, validateContactName, validateContactPhone } from '@/utils/validation';
import type {
  VenueManagerRegisterScreenNavigationProp,
  VenueManagerRegisterScreenRouteProp,
} from '@/navigation/types';

export function VenueManagerRegisterScreen() {
  const navigation = useNavigation<VenueManagerRegisterScreenNavigationProp>();
  const route = useRoute<VenueManagerRegisterScreenRouteProp>();
  const { phone, password, nickname } = route.params;
  const setToken = useAppStore((state) => state.setToken);
  const setUser = useAppStore((state) => state.setUser);

  const [companyName, setCompanyName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [companyNameError, setCompanyNameError] = useState<string | undefined>();
  const [contactNameError, setContactNameError] = useState<string | undefined>();
  const [contactPhoneError, setContactPhoneError] = useState<string | undefined>();
  const [globalError, setGlobalError] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);

  const validateForm = (): boolean => {
    const companyErr = validateCompanyName(companyName);
    const contactNameErr = validateContactName(contactName);
    const contactPhoneErr = validateContactPhone(contactPhone);
    setCompanyNameError(companyErr || undefined);
    setContactNameError(contactNameErr || undefined);
    setContactPhoneError(contactPhoneErr || undefined);
    return !companyErr && !contactNameErr && !contactPhoneErr;
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
        userType: 'venue_manager',
        companyName,
        contactName,
        contactPhone,
      });
      await authService.saveTokens(response.tokens.accessToken, response.tokens.refreshToken);
      setToken(response.tokens.accessToken);
      setUser({
        id: response.user.id,
        nickname: response.user.nickname,
        userType: response.user.userType,
      });
      navigation.navigate('Profile');
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
        label="公司名称"
        value={companyName}
        onChangeText={(text) => {
          setCompanyName(text);
          setCompanyNameError(undefined);
        }}
        placeholder="请输入公司名称"
        error={companyNameError}
        accessibilityLabel="公司名称输入框"
      />
      <ValidatedTextInput
        label="联系人姓名"
        value={contactName}
        onChangeText={(text) => {
          setContactName(text);
          setContactNameError(undefined);
        }}
        placeholder="请输入联系人姓名"
        error={contactNameError}
        accessibilityLabel="联系人姓名输入框"
      />
      <ValidatedTextInput
        label="联系人手机号"
        value={contactPhone}
        onChangeText={(text) => {
          setContactPhone(text);
          setContactPhoneError(undefined);
        }}
        placeholder="请输入联系人手机号"
        keyboardType="phone-pad"
        error={contactPhoneError}
        accessibilityLabel="联系人手机号输入框"
      />
    </FormContainer>
  );
}
