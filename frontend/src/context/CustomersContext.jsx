import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { api } from '../services/api';

const CustomersContext = createContext();

export const useCustomers = () => useContext(CustomersContext);

export const CustomersProvider = ({ children }) => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getCustomers();
      setCustomers(Array.isArray(res.data) ? res.data : []);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch customers:', err);
      setError(err.response?.data?.message || 'Failed to load customers.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  return (
    <CustomersContext.Provider value={{ customers, loading, error, reload: fetchCustomers }}>
      {children}
    </CustomersContext.Provider>
  );
};
