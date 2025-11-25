import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, Alert } from 'react-native';
import api, { setAuthToken } from '../apiClient';
import { useNavigation, useRoute } from '@react-navigation/native';

export default function DashboardScreen(){
  const nav = useNavigation();
  const route = useRoute();
  const token = route.params?.token;
  const [balance, setBalance] = useState('0.00');
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    if (token) setAuthToken(token);
    fetchAccount();
    fetchTx();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchAccount = async () => {
    try {
      const res = await api.get('/me/account');
      setBalance(res.data.balance);
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Could not fetch account');
    }
  };

  const fetchTx = async () => {
    try {
      const res = await api.get('/me/transactions');
      setTransactions(res.data.transactions);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <View className="flex-1 bg-slate-50 p-6">
      <Text className="text-xl font-semibold mb-2">Welcome</Text>
      <Text className="text-sm text-gray-600">Available Balance</Text>
      <Text className="text-3xl font-bold text-blue-600 mt-2">${balance}</Text>

      <TouchableOpacity onPress={() => nav.navigate('Transfer')} className="bg-indigo-600 rounded-md p-3 mt-6">
        <Text className="text-white text-center font-semibold">Make Transfer</Text>
      </TouchableOpacity>

      <Text className="text-lg font-semibold mt-6 mb-2">Recent Transactions</Text>
      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        renderItem={({item}) => (
          <View className="flex-row justify-between py-3 border-b border-gray-200">
            <Text className="text-sm">{item.note || item.type}</Text>
            <Text className={`text-sm ${parseFloat(item.amount) < 0 ? 'text-red-500' : 'text-green-600'}`}>
              {parseFloat(item.amount) < 0 ? '-' : '+'}${Math.abs(item.amount)}
            </Text>
          </View>
        )}
      />
    </View>
  );
}
