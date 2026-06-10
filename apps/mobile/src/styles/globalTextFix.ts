import { Platform, TextStyle } from 'react-native';

/**
 * Android 文本渲染修复
 * 
 * 问题：Android 上 fontWeight 会导致文本宽度计算不准确，
 * 最后一个字符（尤其是数字和字母）被截断。
 * 
 * 解决方案：为所有文本样式添加 includeFontPadding: false
 */

export const androidTextFix: TextStyle = Platform.OS === 'android'
  ? {
      includeFontPadding: false,
      textAlignVertical: 'center',
    }
  : {};
