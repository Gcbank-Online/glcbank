import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import api, { setAuthToken } from '../apiClient';
import { useNavigation } from '@react-navigation/native';

export default function LoginScreen(){
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const nav = useNavigation();

  const handleLogin = async () => {
    try {
      const res = await api.post('/auth/login', { email, password });
      const token = res.data.token;
      setAuthToken(token);
      nav.replace('Dashboard', { token });
    } catch (err) {
      console.error(err);
      Alert.alert('Login failed', err?.response?.data?.error || err.message);
    }
  };

  const handleRegister = async () => {
    try {
      const res = await api.post('/auth/register', { email, password });
      const token = res.data.token;
      setAuthToken(token);
      nav.replace('Dashboard', { token });
    } catch (err) {
      console.error(err);
      Alert.alert('Register failed', err?.response?.data?.error || err.message);
    }
  };

  return (
    <View className="flex-1 justify-center p-6 bg-white">
      <Text className="text-3xl font-bold text-center mb-6">GCBank</Text>

      <TextInput placeholder="Email" value={email} onChangeText={setEmail}
        className="border border-gray-300 rounded-md p-3 mb-4" keyboardType="email-address" autoCapitalize="none" />

      <TextInput placeholder="Password" value={password} onChangeText={setPassword}
        className="border border-gray-300 rounded-md p-3 mb-6" secureTextEntry />

      <TouchableOpacity onPress={handleLogin} className="bg-blue-600 rounded-md p-3 mb-3">
        <Text className="text-white text-center font-semibold">Login</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={handleRegister} className="bg-green-600 rounded-md p-3">
        <Text className="text-white text-center font-semibold">Create Account</Text>
      </TouchableOpacity>
    </View>
  );
}
