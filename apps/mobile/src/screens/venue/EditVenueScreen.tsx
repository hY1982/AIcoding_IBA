import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ValidatedTextInput } from '@/components/form/ValidatedTextInput';
import { FormContainer } from '@/components/form/FormContainer';
import { venueService } from '@/api/venue.service';
import { FLOOR_MATERIALS, FLOOR_MATERIAL_LABELS, COURT_TYPES, COURT_TYPE_LABELS } from '@shared/venue';
import type { VenueDetail } from '@shared/venue';
import type { EditVenueScreenNavigationProp, EditVenueScreenRouteProp } from '@/navigation/types';

export function EditVenueScreen() {
  const navigation = useNavigation<EditVenueScreenNavigationProp>();
  const route = useRoute<EditVenueScreenRouteProp>();
  const { venue } = route.params;

  const [name, setName] = useState(venue.name);
  const [address, setAddress] = useState(venue.address);
  const [pricePerHour, setPricePerHour] = useState(String(venue.pricePerHour));
  const [courtCount, setCourtCount] = useState(String(venue.courtCount));
  const [floorMaterial, setFloorMaterial] = useState(venue.floorMaterial);
  const [courtType, setCourtType] = useState(venue.courtType);
  const [lighting, setLighting] = useState(venue.lighting || '');
  const [turnoverTime, setTurnoverTime] = useState(venue.turnoverTime ? String(venue.turnoverTime) : '');

  const [ventilation, setVentilation] = useState(venue.ventilation ?? false);
  const [bigFan, setBigFan] = useState(venue.bigFan ?? false);
  const [airCondition, setAirCondition] = useState(venue.airCondition ?? false);
  const [parking, setParking] = useState(venue.parking ?? false);
  const [restroom, setRestroom] = useState(venue.restroom ?? false);
  const [shower, setShower] = useState(venue.shower ?? false);
  const [lockerRoom, setLockerRoom] = useState(venue.lockerRoom ?? false);
  const [videoRecord, setVideoRecord] = useState(venue.videoRecord ?? false);

  const [nameError, setNameError] = useState<string | undefined>();
  const [addressError, setAddressError] = useState<string | undefined>();
  const [priceError, setPriceError] = useState<string | undefined>();
  const [globalError, setGlobalError] = useState<string | undefined>();
  const [successMessage, setSuccessMessage] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);

  const validateForm = (): boolean => {
    let valid = true;

    if (!name.trim()) {
      setNameError('请输入场地名称');
      valid = false;
    } else if (name.length > 100) {
      setNameError('场地名称不能超过100个字符');
      valid = false;
    } else {
      setNameError(undefined);
    }

    if (!address.trim()) {
      setAddressError('请输入场地地址');
      valid = false;
    } else if (address.length > 255) {
      setAddressError('地址不能超过255个字符');
      valid = false;
    } else {
      setAddressError(undefined);
    }

    const price = Number(pricePerHour);
    if (!pricePerHour.trim() || isNaN(price) || price <= 0) {
      setPriceError('请输入有效的小时价格（大于0）');
      valid = false;
    } else {
      setPriceError(undefined);
    }

    return valid;
  };

  const handleSubmit = async () => {
    setGlobalError(undefined);
    setSuccessMessage(undefined);
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      const dto = {
        name: name.trim(),
        address: address.trim(),
        pricePerHour: Number(pricePerHour),
        courtCount: courtCount ? Number(courtCount) : 1,
        floorMaterial,
        courtType,
        lighting: lighting.trim() || undefined,
        turnoverTime: turnoverTime ? Number(turnoverTime) : undefined,
        ventilation,
        bigFan,
        airCondition,
        parking,
        restroom,
        shower,
        lockerRoom,
        videoRecord,
      };

      await venueService.updateVenue(venue.id, dto);
      setSuccessMessage('场地更新成功');
      navigation.goBack();
    } catch (error) {
      const message = error instanceof Error ? error.message : '更新失败';
      setGlobalError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const ToggleButton = ({
    label,
    value,
    onToggle,
  }: {
    label: string;
    value: boolean;
    onToggle: (v: boolean) => void;
  }) => (
    <TouchableOpacity
      style={[styles.toggleButton, value ? styles.toggleActive : null]}
      onPress={() => onToggle(!value)}
    >
      <Text style={value ? styles.toggleTextActive : styles.toggleText}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <FormContainer
      onSubmit={handleSubmit}
      submitLabel="保存修改"
      isLoading={isLoading}
      error={globalError}
      success={successMessage}
    >
      <ValidatedTextInput
        label="场地名称 *"
        value={name}
        onChangeText={(text) => {
          setName(text);
          setNameError(undefined);
        }}
        placeholder="请输入场地名称"
        error={nameError}
        accessibilityLabel="场地名称输入框"
      />
      <ValidatedTextInput
        label="场地地址 *"
        value={address}
        onChangeText={(text) => {
          setAddress(text);
          setAddressError(undefined);
        }}
        placeholder="请输入详细地址"
        error={addressError}
        accessibilityLabel="场地地址输入框"
      />
      <ValidatedTextInput
        label="每小时价格（元） *"
        value={pricePerHour}
        onChangeText={(text) => {
          setPricePerHour(text);
          setPriceError(undefined);
        }}
        placeholder="请输入每小时价格"
        keyboardType="decimal-pad"
        error={priceError}
        accessibilityLabel="价格输入框"
      />
      <ValidatedTextInput
        label="球场数量"
        value={courtCount}
        onChangeText={setCourtCount}
        placeholder="请输入球场数量"
        keyboardType="numeric"
        accessibilityLabel="球场数量输入框"
      />

      <Text style={styles.sectionLabel}>地面材质</Text>
      <View style={styles.rowWrap}>
        {FLOOR_MATERIALS.map((material) => (
          <TouchableOpacity
            key={material}
            style={[styles.chip, floorMaterial === material ? styles.chipActive : null]}
            onPress={() => setFloorMaterial(material === floorMaterial ? undefined : material)}
          >
            <Text style={floorMaterial === material ? styles.chipTextActive : styles.chipText}>
              {FLOOR_MATERIAL_LABELS[material]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionLabel}>场地类型</Text>
      <View style={styles.rowWrap}>
        {COURT_TYPES.map((type) => (
          <TouchableOpacity
            key={type}
            style={[styles.chip, courtType === type ? styles.chipActive : null]}
            onPress={() => setCourtType(type === courtType ? undefined : type)}
          >
            <Text style={courtType === type ? styles.chipTextActive : styles.chipText}>
              {COURT_TYPE_LABELS[type]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ValidatedTextInput
        label="照明情况"
        value={lighting}
        onChangeText={setLighting}
        placeholder="例如：LED专业照明"
        accessibilityLabel="照明输入框"
      />
      <ValidatedTextInput
        label="翻场时间（分钟）"
        value={turnoverTime}
        onChangeText={setTurnoverTime}
        placeholder="请输入翻场时间"
        keyboardType="numeric"
        accessibilityLabel="翻场时间输入框"
      />

      <Text style={styles.sectionLabel}>配套设施</Text>
      <View style={styles.toggleRow}>
        <ToggleButton label="通风" value={ventilation} onToggle={setVentilation} />
        <ToggleButton label="大风扇" value={bigFan} onToggle={setBigFan} />
        <ToggleButton label="空调" value={airCondition} onToggle={setAirCondition} />
      </View>
      <View style={styles.toggleRow}>
        <ToggleButton label="停车场" value={parking} onToggle={setParking} />
        <ToggleButton label="洗手间" value={restroom} onToggle={setRestroom} />
        <ToggleButton label="淋浴" value={shower} onToggle={setShower} />
      </View>
      <View style={styles.toggleRow}>
        <ToggleButton label="更衣室" value={lockerRoom} onToggle={setLockerRoom} />
        <ToggleButton label="录像" value={videoRecord} onToggle={setVideoRecord} />
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
  toggleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 8,
  },
  toggleButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 8,
  },
  toggleActive: {
    backgroundColor: '#27ae60',
    borderColor: '#27ae60',
  },
  toggleText: {
    color: '#333',
    fontSize: 14,
  },
  toggleTextActive: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
