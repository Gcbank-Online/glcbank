import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, Alert } from 'react-native';
import api from '../apiClient';
import { useNavigation } from '@react-navigation/native';

export default function TransferScreen(){
  const [toAccount, setToAccount] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const nav = useNavigation();

  const handleTransfer = async () => {
    const amt = parseFloat(amount);
    if (!toAccount || !amt || amt <= 0) return Alert.alert('Invalid', 'Enter a positive amount and recipient account');
    try {
      const res = await api.post('/transfers', {
        from_account_number: '', // backend will use auth to find sender account
        to_account_number: toAccount,
        amount: amt,
        note
      });
      Alert.alert('Success', res.data.message);
      nav.goBack();
    } catch (err) {
      console.error(err);
      Alert.alert('Transfer failed', err?.response?.data?.error || err.message);
    }
  };

  return (
    <View className="flex-1 p-6 bg-white">
      <TextInput placeholder="Recipient account number" value={toAccount} onChangeText={setToAccount}
        className="border border-gray-300 rounded-md p-3 mb-4" />
      <TextInput placeholder="Amount (e.g. 100.50)" value={amount} onChangeText={setAmount}
        keyboardType="decimal-pad" className="border border-gray-300 rounded-md p-3 mb-4" />
      <TextInput placeholder="Note (optional)" value={note} onChangeText={setNote}
        className="border border-gray-300 rounded-md p-3 mb-4" />

      <TouchableOpacity onPress={handleTransfer} className="bg-blue-600 rounded-md p-3">
        <Text className="text-white text-center font-semibold">Send</Text>
      </TouchableOpacity>
    </View>
  );
}
