import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ValidatedTextInput } from '@/components/form/ValidatedTextInput';
import { FormContainer } from '@/components/form/FormContainer';
import { venueManagerService } from '@/api/venue-manager.service';
import type {
  EditVenueManagerProfileScreenNavigationProp,
  EditVenueManagerProfileScreenRouteProp,
} from '@/navigation/types';

export function EditVenueManagerProfileScreen() {
  const navigation = useNavigation<EditVenueManagerProfileScreenNavigationProp>();
  const route = useRoute<EditVenueManagerProfileScreenRouteProp>();
  const { profile } = route.params;

  const [companyName, setCompanyName] = useState(profile.companyName || '');
  const [contactName, setContactName] = useState(profile.contactName || '');
  const [contactPhone, setContactPhone] = useState(profile.contactPhone || '');

  const [companyNameError, setCompanyNameError] = useState<string | undefined>();
  const [contactNameError, setContactNameError] = useState<string | undefined>();
  const [contactPhoneError, setContactPhoneError] = useState<string | undefined>();
  const [globalError, setGlobalError] = useState<string | undefined>();
  const [successMessage, setSuccessMessage] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);

  const validateForm = (): boolean => {
    let valid = true;

    if (companyName && companyName.length > 100) {
      setCompanyNameError('公司名称不能超过100个字符');
      valid = false;
    } else {
      setCompanyNameError(undefined);
    }

    if (contactName && contactName.length > 50) {
      setContactNameError('联系人姓名不能超过50个字符');
      valid = false;
    } else {
      setContactNameError(undefined);
    }

    if (contactPhone) {
      const phoneRegex = /^1[3-9]\d{9}$/;
      if (!phoneRegex.test(contactPhone)) {
        setContactPhoneError('请输入有效的手机号');
        valid = false;
      } else {
        setContactPhoneError(undefined);
      }
    } else {
      setContactPhoneError(undefined);
    }

    return valid;
  };

  const handleSubmit = async () => {
    setGlobalError(undefined);
    setSuccessMessage(undefined);
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      await venueManagerService.updateProfile({
        companyName: companyName || undefined,
        contactName: contactName || undefined,
        contactPhone: contactPhone || undefined,
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
        label="联系电话"
        value={contactPhone}
        onChangeText={(text) => {
          setContactPhone(text);
          setContactPhoneError(undefined);
        }}
        placeholder="请输入联系电话"
        keyboardType="phone-pad"
        error={contactPhoneError}
        accessibilityLabel="联系电话输入框"
      />
    </FormContainer>
  );
}
